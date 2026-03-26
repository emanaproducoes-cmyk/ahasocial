# 🦊 AHA SOCIAL — Plataforma de Gestão de Redes Sociais

> **Agência de Marketing · Mídias Criativas · Automação Digital**
> *Seja Digital ou Seja Nada — AHA Publicità*

---

## 🚀 Deploy Rápido (GitHub + Vercel)

### PASSO 1 — Criar repositório no GitHub

1. Acesse [github.com](https://github.com) e faça login
2. Clique em **"New repository"** (botão verde)
3. Nome: `aha-social`
4. Deixe como **Public**
5. **NÃO** marque "Add README" (já temos)
6. Clique em **"Create repository"**

---

### PASSO 2 — Enviar os arquivos

Após criar o repositório, o GitHub mostrará comandos. Use no terminal:

```bash
# Clone ou entre na pasta do projeto
cd aha-social

# Iniciar Git
git init

# Adicionar todos os arquivos
git add .

# Commit inicial
git commit -m "🚀 AHA Social - Lançamento inicial"

# Conectar ao GitHub (substitua SEU_USUARIO pelo seu username)
git remote add origin https://github.com/SEU_USUARIO/aha-social.git

# Enviar
git branch -M main
git push -u origin main
```

---

### PASSO 3 — Deploy no Vercel

1. Acesse [vercel.com](https://vercel.com) e clique em **"Sign Up"** ou **"Log In"**
2. Conecte com sua conta **GitHub**
3. Clique em **"Add New Project"**
4. Selecione o repositório `aha-social`
5. Configurações:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./`
   - **Output Directory:** `./` (deixar em branco)
6. Clique em **"Deploy"** 🚀

Em ~30 segundos seu app estará no ar com uma URL como:
```
https://aha-social.vercel.app
```

---

### PASSO 4 — Domínio personalizado (opcional)

No painel do Vercel:
1. Vá em **Settings → Domains**
2. Adicione: `aha.social` ou `social.ahapublicita.com.br`
3. Configure o DNS conforme as instruções do Vercel

---

## 🛠️ Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| 🔐 Login | Autenticação simulada (Google OAuth pronto para integrar) |
| 📊 Dashboard | KPIs, gráficos linha/barra/pizza, funil de aprovação |
| 🔗 Contas | Gerenciamento de contas de redes sociais |
| 📅 Agendamentos | Lista/Grade/Calendário, link de aprovação |
| 🖼️ Posts | Visão geral de todos os conteúdos |
| 🔍 Em Análise | Conteúdos aguardando aprovação |
| ✅ Aprovados | Conteúdos aprovados pelos clientes |
| ❌ Rejeitados | Conteúdos com pedido de revisão |
| 🚀 Campanhas | Planejamento mensal completo |
| 💰 Tráfego Pago | CPC, CPM, CAC, CTR, ROAS |

---

## 📱 Responsivo

- ✅ Desktop (1920px+)
- ✅ Laptop 13" (1280px)
- ✅ Tablet (768px)
- ✅ Mobile (375px)

---

## 🎨 Stack Técnica

- **HTML5 + CSS3 + JavaScript Vanilla**
- **Chart.js 4.4** — Gráficos modernos
- **Google Fonts** — Bebas Neue + Poppins
- **LocalStorage** — Persistência de dados
- **Zero dependências** de framework (deploy imediato)

---

## 🔗 Página de Aprovação para Clientes

Quando um agendamento é enviado para aprovação, um link único é gerado:
```
https://aha-social.vercel.app/#aprovacao/ID_DO_POST
```

O cliente acessa pelo celular, tablet ou desktop e pode:
- ✅ **Aprovar** o conteúdo
- ✏️ **Solicitar Correção** com comentários
- ❌ **Rejeitar** com justificativa

---

*AHA Publicità © 2026 — Todos os direitos reservados*
