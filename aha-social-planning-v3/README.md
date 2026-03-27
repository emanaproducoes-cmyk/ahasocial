# 🚀 AHA Social Planning

Plataforma completa de gestão de redes sociais: do briefing à publicação, com fluxo de aprovação, campanhas, agendamentos e tráfego pago.

---

## 📁 Estrutura do Projeto

```
aha-social-planning/
│
├── public/                          ← Frontend (deploy no Vercel)
│   ├── index.html                   ← App principal (login + todas as páginas)
│   ├── assets/
│   │   └── banner.png               ← Banner da AHA na tela de login
│   ├── css/
│   │   └── app.css                  ← Todos os estilos
│   └── js/
│       ├── firebase-config.js       ← Config do Firebase + helpers
│       └── app.js                   ← Toda a lógica do app
│
├── api/                             ← Backend (deploy no Railway / Render / EC2)
│   ├── server.js                    ← Express API + rotas
│   ├── package.json                 ← Dependências Node.js
│   └── .env.example                 ← Template de variáveis de ambiente
│
├── vercel.json                      ← Configuração do deploy Vercel
└── README.md                        ← Este arquivo
```

---

## ✨ Funcionalidades

| Módulo           | Recursos                                                          |
|------------------|-------------------------------------------------------------------|
| **Login**        | E-mail/senha + Google OAuth, banner visual da marca               |
| **Dashboard**    | KPIs, funil de conteúdo, 4 gráficos com hover/tooltip, tabela    |
| **Contas**       | Cards por rede social, add nova conta, sincronização              |
| **Agendamentos** | Visão lista/grade/calendário, upload de criativo, envio p/ aprova.|
| **Posts**        | Cards com status, filtros, detalhes em modal                      |
| **Em Análise**   | Posts aguardando aprovação do cliente                             |
| **Aprovados**    | Conteúdos prontos para publicação                                 |
| **Rejeitados**   | Posts com pendências, histórico                                   |
| **Campanhas**    | Cards de campanha com progresso, budget, métricas                 |
| **Tráfego Pago** | CPC, CPM, CTR, CAC, ROAS por plataforma, tabela de criativos      |
| **Link Aprovação**| Link público para o cliente aprovar/rejeitar/comentar           |

---

## 🌐 Deploy Frontend no Vercel

### 1. Instale o Vercel CLI
```bash
npm install -g vercel
```

### 2. Faça login
```bash
vercel login
```

### 3. Clone e faça o deploy
```bash
git clone https://github.com/SEU_USUARIO/aha-social-planning.git
cd aha-social-planning
vercel --prod
```

> O Vercel detecta automaticamente o `vercel.json` e serve a pasta `public/` como site estático.

### 4. (Opcional) Via GitHub + Vercel Dashboard
1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"**
3. Conecte seu repositório GitHub
4. O Vercel detecta as configurações automaticamente
5. Clique em **"Deploy"** ✅

---

## 🔥 Configurar Firebase (para persistência real)

### 1. Crie um projeto no Firebase
1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Clique em **"Adicionar projeto"** → dê um nome → crie
3. Vá em **Autenticação** → **Método de login** → habilite:
   - ✅ E-mail/senha
   - ✅ Google

### 2. Crie o banco Firestore
1. Vá em **Firestore Database** → **Criar banco de dados**
2. Escolha **Modo de produção**
3. Selecione região (us-east1 ou southamerica-east1)

### 3. Regras do Firestore (básicas)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read:  if request.auth != null || resource.data.keys().hasAny(['approvalToken']);
      allow write: if request.auth != null;
    }
    match /{collection}/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Obtenha as credenciais do frontend
1. Vá em **Project Settings** (ícone de engrenagem) → **Geral**
2. Em "Seus apps", clique em **"Adicionar app"** → Web
3. Copie o objeto `firebaseConfig`
4. Cole em `public/js/firebase-config.js` substituindo os valores de exemplo

### 5. Habilite o Firebase no HTML
Em `public/index.html`, descomente o bloco Firebase nos scripts:
```html
<!-- Descomente estas linhas -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js"></script>
<script src="js/firebase-config.js"></script>
```

---

## 🖥️ Backend Node.js (API opcional)

O frontend funciona **100% offline** com localStorage. O backend é necessário apenas para:
- Autenticação server-side mais segura
- Integrações com APIs das redes sociais (Instagram Graph API, etc.)
- Webhooks de aprovação
- Processamento de uploads

### Instalação local
```bash
cd api
npm install
cp .env.example .env
# edite .env com suas credenciais Firebase
npm run dev
```

### Deploy no Railway (recomendado para Node.js)
1. Acesse [railway.app](https://railway.app)
2. **"New Project"** → **"Deploy from GitHub repo"**
3. Selecione a pasta `api/`
4. Configure as variáveis de ambiente no painel do Railway
5. ✅ Deploy automático a cada push!

### Deploy no Render
1. Acesse [render.com](https://render.com)
2. **"New Web Service"** → conecte o repositório
3. Root directory: `api`
4. Build command: `npm install`
5. Start command: `npm start`
6. Configure as env vars e clique em **"Create Web Service"**

---

## 📦 Estrutura Firebase (Coleções)

```
Firestore Database
├── posts/
│   ├── {postId}
│   │   ├── title:       string
│   │   ├── platform:    "ig" | "fb" | "yt" | "tt" | "li"
│   │   ├── status:      "pending" | "approved" | "rejected"
│   │   ├── date:        string (YYYY-MM-DD)
│   │   ├── caption:     string
│   │   ├── campaign:    string
│   │   ├── thumb:       string (emoji ou URL)
│   │   ├── createdAt:   timestamp
│   │   └── createdBy:   string (user UID)
│
├── accounts/
│   └── {accountId}
│       ├── name, handle, platform, followers, engagement, posts, status
│
├── campaigns/
│   └── {campaignId}
│       ├── name, start, end, budget, status, posts, approved, pending, rejected
│
└── traffic/
    └── {entryId}
        ├── creative, platform, status, investment, clicks, ctr, cpc, roas
```

---

## 🎨 Tecnologias

| Camada   | Tecnologia          |
|----------|---------------------|
| Frontend | HTML5 + CSS3 + JS vanilla |
| Gráficos | Chart.js 4.4        |
| Auth     | Firebase Auth (Google + Email) |
| Database | Firebase Firestore  |
| Storage  | Firebase Storage    |
| Backend  | Node.js + Express   |
| Deploy FE| Vercel              |
| Deploy BE| Railway ou Render   |
| CI/CD    | GitHub → Vercel auto-deploy |

---

## 🐛 Desenvolvimento Local

```bash
# Frontend (sem backend)
cd public
npx serve .       # ou: python3 -m http.server 3000
# Acesse: http://localhost:3000

# Frontend + Backend
cd api && npm run dev        # API em :3001
cd public && npx serve .     # Frontend em :3000
```

---

## 📌 Próximos Passos

- [ ] Integração real com Instagram Graph API
- [ ] Upload de arquivos para Firebase Storage
- [ ] Notificações push / e-mail automático ao cliente
- [ ] Relatórios em PDF exportável
- [ ] App mobile com React Native / PWA

---

**AHA Social Planning © 2026 · Seja Digital ou Seja Nada 🚀**
