require('dotenv').config();
const express=require('express'),cors=require('cors'),helmet=require('helmet'),morgan=require('morgan'),rateLimit=require('express-rate-limit');
const app=express(),PORT=process.env.PORT||3001;
app.use(helmet());app.use(cors({origin:process.env.FRONTEND_URL||'*',credentials:true}));app.use(morgan('dev'));app.use(express.json({limit:'10mb'}));app.use('/api/',rateLimit({windowMs:15*60*1000,max:200}));

// Firebase Admin - only initialize if credentials are properly configured
const admin=require('firebase-admin');
let db=null,TS=null,firebaseConfigured=false;

if(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY){
  try{
    if(!admin.apps.length){
      admin.initializeApp({
        credential:admin.credential.cert({
          projectId:process.env.FIREBASE_PROJECT_ID,
          clientEmail:process.env.FIREBASE_CLIENT_EMAIL,
          privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')
        }),
        storageBucket:process.env.FIREBASE_STORAGE_BUCKET
      });
    }
    db=admin.firestore();
    TS=admin.firestore.FieldValue.serverTimestamp;
    firebaseConfigured=true;
    console.log('✅ Firebase Admin inicializado com sucesso');
  }catch(e){
    console.warn('⚠️ Firebase Admin não configurado:',e.message);
  }
}else{
  console.warn('⚠️ Firebase Admin não configurado - variáveis de ambiente ausentes. A API funcionará em modo limitado.');
}
async function auth(req,res,next){
  if(!firebaseConfigured){
    // Em modo local, aceita qualquer requisição mas não valida tokens
    req.user={uid:'local-user'};
    return next();
  }
  const t=req.headers.authorization?.split('Bearer ')[1];
  if(!t)return res.status(401).json({error:'Token não fornecido.'});
  try{req.user=await admin.auth().verifyIdToken(t);next();}
  catch{res.status(401).json({error:'Token inválido.'});}
}
app.get('/health',(_,res)=>res.json({status:'ok',time:new Date(),firebaseConfigured}));

// Middleware para verificar se Firebase está configurado
function requireFirebase(req,res,next){
  if(!firebaseConfigured||!db)return res.status(503).json({error:'Firebase não configurado. Use o modo local no frontend.'});
  next();
}

// Posts
app.get('/api/posts',auth,requireFirebase,async(_,res)=>{const s=await db.collection('posts').orderBy('createdAt','desc').get();res.json(s.docs.map(d=>({id:d.id,...d.data()})));});
app.post('/api/posts',auth,requireFirebase,async(req,res)=>{const r=await db.collection('posts').add({...req.body,createdBy:req.user.uid,createdAt:TS()});res.status(201).json({id:r.id});});
app.patch('/api/posts/:id',auth,requireFirebase,async(req,res)=>{await db.collection('posts').doc(req.params.id).update({...req.body,updatedAt:TS()});res.json({id:req.params.id});});
app.delete('/api/posts/:id',auth,requireFirebase,async(req,res)=>{await db.collection('posts').doc(req.params.id).delete();res.json({deleted:true});});
// Accounts
app.get('/api/accounts',auth,requireFirebase,async(_,res)=>{const s=await db.collection('accounts').orderBy('createdAt','desc').get();res.json(s.docs.map(d=>({id:d.id,...d.data()})));});
app.post('/api/accounts',auth,requireFirebase,async(req,res)=>{const r=await db.collection('accounts').add({...req.body,createdBy:req.user.uid,createdAt:TS()});res.status(201).json({id:r.id});});
app.patch('/api/accounts/:id',auth,requireFirebase,async(req,res)=>{await db.collection('accounts').doc(req.params.id).update({...req.body,updatedAt:TS()});res.json({id:req.params.id});});
app.delete('/api/accounts/:id',auth,requireFirebase,async(req,res)=>{await db.collection('accounts').doc(req.params.id).delete();res.json({deleted:true});});
// Campaigns
app.get('/api/campaigns',auth,requireFirebase,async(_,res)=>{const s=await db.collection('campaigns').orderBy('createdAt','desc').get();res.json(s.docs.map(d=>({id:d.id,...d.data()})));});
app.post('/api/campaigns',auth,requireFirebase,async(req,res)=>{const r=await db.collection('campaigns').add({...req.body,status:'active',posts:0,approved:0,pending:0,rejected:0,createdBy:req.user.uid,createdAt:TS()});res.status(201).json({id:r.id});});
app.patch('/api/campaigns/:id',auth,requireFirebase,async(req,res)=>{await db.collection('campaigns').doc(req.params.id).update({...req.body,updatedAt:TS()});res.json({id:req.params.id});});
app.delete('/api/campaigns/:id',auth,requireFirebase,async(req,res)=>{await db.collection('campaigns').doc(req.params.id).delete();res.json({deleted:true});});
// Aprovação pública
app.get('/api/approval/:id',requireFirebase,async(req,res)=>{const d=await db.collection('posts').doc(req.params.id).get();if(!d.exists)return res.status(404).json({error:'Não encontrado.'});const p={id:d.id,...d.data()};res.json({id:p.id,title:p.title,platform:p.platform,date:p.date,caption:p.caption,status:p.status,campaign:p.campaign,fileUrl:p.fileUrl,fileType:p.fileType});});
app.post('/api/approval/:id',requireFirebase,async(req,res)=>{const{action,comment,clientName}=req.body;const sm={approve:'approved',reject:'rejected',correct:'pending'};const ns=sm[action];if(!ns)return res.status(400).json({error:'Ação inválida.'});await db.collection('posts').doc(req.params.id).update({status:ns,clientReview:{action,comment,clientName,reviewedAt:TS()}});res.json({success:true,newStatus:ns});});
// Instagram token exchange
app.post('/api/instagram/token',auth,requireFirebase,async(req,res)=>{
  const{code,redirectUri,accountId}=req.body;if(!code)return res.status(400).json({error:'Código ausente.'});
  try{
    const nodeFetch=require('node-fetch');
    const t=await nodeFetch('https://api.instagram.com/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.INSTAGRAM_APP_ID,client_secret:process.env.INSTAGRAM_APP_SECRET,grant_type:'authorization_code',redirect_uri:redirectUri,code})});
    const td=await t.json();if(td.error_type)return res.status(400).json({error:td.error_message});
    const{access_token:st,user_id:uid}=td;
    const lt=await nodeFetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${st}`);
    const ld=await lt.json();const longToken=ld.access_token||st;
    const pf=await nodeFetch(`https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${longToken}`);
    const profile=await pf.json();
    if(accountId)await db.collection('accounts').doc(accountId).update({igConnected:true,igUserId:String(uid),igUsername:profile.username,igToken:longToken,igConnectedAt:TS()});
    res.json({success:true,igUserId:String(uid),igUsername:profile.username,mediaCount:profile.media_count});
  }catch(e){res.status(500).json({error:e.message});}
});
// Instagram Publish
app.post('/api/instagram/publish',auth,requireFirebase,async(req,res)=>{
  const{accountId,imageUrl,caption}=req.body;
  const ad=await db.collection('accounts').doc(accountId).get();if(!ad.exists)return res.status(404).json({error:'Conta não encontrada.'});
  const acc=ad.data();if(!acc.igConnected)return res.status(400).json({error:'Instagram não conectado.'});
  try{
    const nodeFetch=require('node-fetch');
    const cr=await nodeFetch(`https://graph.instagram.com/${acc.igUserId}/media`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_url:imageUrl,caption,access_token:acc.igToken})});
    const{id:cid,error:ce}=await cr.json();if(ce)return res.status(400).json({error:ce.message});
    await new Promise(r=>setTimeout(r,3000));
    const pr=await nodeFetch(`https://graph.instagram.com/${acc.igUserId}/media_publish`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({creation_id:cid,access_token:acc.igToken})});
    const pd=await pr.json();if(pd.error)return res.status(400).json({error:pd.error.message});
    res.json({success:true,igMediaId:pd.id});
  }catch(e){res.status(500).json({error:e.message});}
});
// Instagram Insights
app.get('/api/instagram/insights/:accountId',auth,requireFirebase,async(req,res)=>{
  const ad=await db.collection('accounts').doc(req.params.accountId).get();if(!ad.exists)return res.status(404).json({error:'Conta não encontrada.'});
  const acc=ad.data();if(!acc.igConnected)return res.status(400).json({error:'Instagram não conectado.'});
  try{const nodeFetch=require('node-fetch');const r=await nodeFetch(`https://graph.instagram.com/${acc.igUserId}/insights?metric=impressions,reach,profile_views&period=day&since=${Math.floor(Date.now()/1000)-7*86400}&until=${Math.floor(Date.now()/1000)}&access_token=${acc.igToken}`);res.json(await r.json());}
  catch(e){res.status(500).json({error:e.message});}
});
app.use((_,res)=>res.status(404).json({error:'Não encontrado.'}));
app.use((err,_,res,__)=>{console.error(err);res.status(500).json({error:'Erro interno.'});});
app.listen(PORT,()=>console.log(`🚀 AHA Social Planning API v3 → http://localhost:${PORT}`));
module.exports=app;
