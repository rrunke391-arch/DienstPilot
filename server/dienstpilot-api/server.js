require('dotenv').config();
const express=require('express');
const cors=require('cors');
const helmet=require('helmet');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const DB=require('better-sqlite3');

const app=express();
const db=new DB('dienstpilot.sqlite');
const PORT=process.env.PORT||3000;
const SECRET=process.env.JWT_SECRET;

if(!SECRET){
  console.error('JWT_SECRET fehlt in .env');
  process.exit(1);
}

app.use(helmet());
app.use(cors());
app.use(express.json({limit:'5mb'}));





// Rollenbasierter Zugriff auf fahrerbezogene Dienstpläne.
require('./driver-plan-access-routes')(app);

// Rollenbasierter Zugriff auf fahrerbezogene Dienstpläne.
// Rollenbasierter Zugriff auf fahrerbezogene Dienstpläne.
// Persönliche Passwortänderung für angemeldete Benutzer.
require('./self-password-routes')(app);

db.exec("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,role TEXT NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS app_data(id INTEGER PRIMARY KEY AUTOINCREMENT,data_key TEXT NOT NULL UNIQUE,data_json TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);");

function makeToken(user){
  return jwt.sign({
    id:user.id,
    username:user.username,
    displayName:user.display_name,
    role:user.role,
    driverProfile:String(user.driver_profile||user.username).trim().toLowerCase()
  },SECRET,{expiresIn:'12h'});
}

function requireLogin(req,res,next){
  const header=req.headers.authorization||'';
  const token=header.startsWith('Bearer ')?header.slice(7):'';
  if(!token){
    return res.status(401).json({error:'Nicht angemeldet'});
  }
  try{
    req.user=jwt.verify(token,SECRET);
    next();
  }catch(e){
    return res.status(401).json({error:'Sitzung abgelaufen'});
  }
}

function requireAdmin(req,res,next){
  if(!req.user || req.user.role!=='Administrator'){
    return res.status(403).json({error:'Keine Administratorrechte'});
  }
  next();
}

app.get('/api/health',function(req,res){
  res.json({
    ok:true,
    app:'DienstPilot API',
    message:'Server laeuft',
    time:new Date().toISOString()
  });
});
app.post('/api/setup-admin',async function(req,res){
  const existing=db.prepare('SELECT id FROM users LIMIT 1').get();
  if(existing){
    return res.status(403).json({error:'Ein Benutzer existiert bereits'});
  }

  const username=String(req.body.username||'').trim();
  const displayName=String(req.body.displayName||'').trim();
  const password=String(req.body.password||'');

  if(!username || !displayName || password.length<8){
    return res.status(400).json({error:'Benutzername, Name und Passwort ab 8 Zeichen erforderlich'});
  }

  const hash=await bcrypt.hash(password,12);
  const info=db.prepare('INSERT INTO users(username,display_name,role,password_hash) VALUES(?,?,?,?)')
    .run(username,displayName,'Administrator',hash);

  res.json({ok:true,id:info.lastInsertRowid,message:'Administrator angelegt'});
});

app.post('/api/login',async function(req,res){
  const username=String(req.body.username||'').trim();
  const password=String(req.body.password||'');
  const user=db.prepare('SELECT * FROM users WHERE username=?').get(username);

  if(!user){
    return res.status(401).json({error:'Benutzername oder Passwort falsch'});
  }

  const ok=await bcrypt.compare(password,user.password_hash);

  if(!ok){
    return res.status(401).json({error:'Benutzername oder Passwort falsch'});
  }

  res.json({
    ok:true,
    token:makeToken(user),
    user:{
      id:user.id,
      username:user.username,
      displayName:user.display_name,
      role:user.role,
      driverProfile:String(user.driver_profile||user.username).trim().toLowerCase()
    }
  });
});

app.get('/api/me',requireLogin,function(req,res){
  res.json({ok:true,user:req.user});
});

app.get('/api/users',requireLogin,requireAdmin,function(req,res){
  const users=db.prepare('SELECT id,username,display_name AS displayName,role,driver_profile AS driverProfile,created_at AS createdAt FROM users ORDER BY id').all();
  res.json({ok:true,users:users});
});
app.post('/api/users',requireLogin,requireAdmin,async function(req,res){
  const username=String(req.body.username||'').trim();
  const displayName=String(req.body.displayName||'').trim();
  const role=String(req.body.role||'').trim();
  const password=String(req.body.password||'');
  const driverProfile=String(req.body.driverProfile||username).trim().toLowerCase();

  const roles=['Administrator','Geschaeftsleitung','Disposition','Fahrer'];

  if(!username || !displayName || !roles.includes(role) || password.length<8){
    return res.status(400).json({error:'Ungueltige Benutzerdaten'});
  }

  try{
    const hash=await bcrypt.hash(password,12);
    const info=db.prepare('INSERT INTO users(username,display_name,role,password_hash,driver_profile) VALUES(?,?,?,?,?)')
      .run(username,displayName,role,hash,driverProfile);
    res.json({ok:true,id:info.lastInsertRowid});
  }catch(e){
    res.status(409).json({error:'Benutzername existiert bereits'});
  }
});

app.put('/api/data/:key',requireLogin,function(req,res){
  const key=String(req.params.key||'').trim();
  if(!key){
    return res.status(400).json({error:'Schluessel fehlt'});
  }

  const json=JSON.stringify(req.body||{});

  db.prepare('INSERT INTO app_data(data_key,data_json,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(data_key) DO UPDATE SET data_json=excluded.data_json,updated_at=CURRENT_TIMESTAMP')
    .run(key,json);

  res.json({ok:true,key:key});
});

app.get('/api/data/:key',requireLogin,function(req,res){
  const row=db.prepare('SELECT data_json,updated_at FROM app_data WHERE data_key=?').get(req.params.key);

  if(!row){
    return res.json({ok:true,data:null});
  }

  res.json({
    ok:true,
    data:JSON.parse(row.data_json),
    updatedAt:row.updated_at
  });
});


/* DienstPilot Admin-Erweiterung: Benutzer löschen + Passwort zurücksetzen */

function dpAdminQuoteColumn(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function dpAdminTableColumns() {
  return db.prepare("PRAGMA table_info(users)").all().map((col) => col.name);
}

function dpAdminFindUserColumn(candidates) {
  const cols = dpAdminTableColumns();
  return candidates.find((name) => cols.includes(name)) || null;
}

function dpAdminSecret() {
  if (typeof JWT_SECRET !== 'undefined' && JWT_SECRET) return JWT_SECRET;
  return process.env.JWT_SECRET;
}

function dpAdminReadToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

function dpAdminUserFromToken(req) {
  const token = dpAdminReadToken(req);
  if (!token) return null;

  const payload = jwt.verify(token, dpAdminSecret());

  const usernameCol = dpAdminFindUserColumn(['username', 'userName', 'name']);
  const roleCol = dpAdminFindUserColumn(['role', 'rolle']);
  const idCol = dpAdminFindUserColumn(['id', 'userId', 'user_id']);

  let row = null;

  if (payload.id && idCol) {
    row = db.prepare(
      `SELECT * FROM users WHERE ${dpAdminQuoteColumn(idCol)} = ?`
    ).get(payload.id);
  }

  const tokenUsername = payload.username || payload.userName || payload.name || payload.sub;

  if (!row && tokenUsername && usernameCol) {
    row = db.prepare(
      `SELECT * FROM users WHERE lower(${dpAdminQuoteColumn(usernameCol)}) = lower(?)`
    ).get(String(tokenUsername));
  }

  return {
    username: row && usernameCol ? row[usernameCol] : tokenUsername,
    role: row && roleCol ? row[roleCol] : payload.role
  };
}

function dpAdminOnly(req, res, next) {
  try {
    const user = dpAdminUserFromToken(req);

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Nicht angemeldet' });
    }

    const username = String(user.username || '').trim().toLowerCase();
    const role = String(user.role || '').trim().toLowerCase();

    if (username !== 'runke' && role !== 'administrator') {
      return res.status(403).json({ ok: false, error: 'Keine Administratorrechte' });
    }

    req.dpAdminUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Anmeldung ungültig' });
  }
}

function dpAdminHashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

app.put('/api/users/:username/password', dpAdminOnly, (req, res) => {
  try {
    const username = String(req.params.username || '').trim();
    const password = String(req.body && req.body.password || '');

    if (!username) {
      return res.status(400).json({ ok: false, error: 'Benutzername fehlt' });
    }

    if (username.toLowerCase() === 'runke') {
      return res.status(403).json({ ok: false, error: 'Runke ist geschützt' });
    }

    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: 'Passwort muss mindestens 8 Zeichen haben' });
    }

    const usernameCol = dpAdminFindUserColumn(['username', 'userName', 'name']);
    const passwordCol = dpAdminFindUserColumn(['passwordHash', 'password_hash', 'password']);

    if (!usernameCol || !passwordCol) {
      return res.status(500).json({ ok: false, error: 'Benutzertabelle konnte nicht gelesen werden' });
    }

    const hash = dpAdminHashPassword(password);

    const result = db.prepare(
      `UPDATE users SET ${dpAdminQuoteColumn(passwordCol)} = ? WHERE lower(${dpAdminQuoteColumn(usernameCol)}) = lower(?)`
    ).run(hash, username);

    if (result.changes === 0) {
      return res.status(404).json({ ok: false, error: 'Benutzer nicht gefunden' });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Passwort konnte nicht zurückgesetzt werden' });
  }
});

app.delete('/api/users/:username', dpAdminOnly, (req, res) => {
  try {
    const username = String(req.params.username || '').trim();

    if (!username) {
      return res.status(400).json({ ok: false, error: 'Benutzername fehlt' });
    }

    if (username.toLowerCase() === 'runke') {
      return res.status(403).json({ ok: false, error: 'Runke kann nicht gelöscht werden' });
    }

    const usernameCol = dpAdminFindUserColumn(['username', 'userName', 'name']);

    if (!usernameCol) {
      return res.status(500).json({ ok: false, error: 'Benutzertabelle konnte nicht gelesen werden' });
    }

    const result = db.prepare(
      `DELETE FROM users WHERE lower(${dpAdminQuoteColumn(usernameCol)}) = lower(?)`
    ).run(username);

    if (result.changes === 0) {
      return res.status(404).json({ ok: false, error: 'Benutzer nicht gefunden' });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Benutzer konnte nicht gelöscht werden' });
  }
});

/* DienstPilot Admin-Erweiterung ENDE */


/* DienstPilot Planrechte: Fahrer sehen nur eigenen Dienstplan */

function dpPlanKey(profile) {
  return 'plan_' + String(profile || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
}

function dpPlanUserFromToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;

  const token = header.slice(7).trim();
  const secret = (typeof JWT_SECRET !== 'undefined' && JWT_SECRET) ? JWT_SECRET : process.env.JWT_SECRET;
  const payload = jwt.verify(token, secret);

  const username = String(payload.username || payload.userName || payload.name || payload.sub || '').trim();
  const role = String(payload.role || '').trim();

  return { username, role };
}

function dpPlanCanAccess(user, profile) {
  const role = String(user.role || '').toLowerCase();
  const username = String(user.username || '').trim().toLowerCase();
  const p = String(profile || '').trim().toLowerCase();

  if (role === 'administrator') return true;
  if (role === 'disposition') return true;
  if (role === 'geschaeftsleitung') return true;
  if (role === 'geschäftsleitung') return true;

  return username === p;
}

function dpPlanRead(key) {
  const cols = db.prepare("PRAGMA table_info(app_data)").all().map(c => c.name);
  const keyCol = cols.includes('key') ? 'key' : cols[0];
  const dataCol = cols.includes('data') ? 'data' : (cols.includes('value') ? 'value' : cols[1]);

  const row = db.prepare(`SELECT "${dataCol}" AS data FROM app_data WHERE "${keyCol}" = ?`).get(key);
  if (!row) return null;

  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

function dpPlanWrite(key, value) {
  const cols = db.prepare("PRAGMA table_info(app_data)").all().map(c => c.name);
  const keyCol = cols.includes('key') ? 'key' : cols[0];
  const dataCol = cols.includes('data') ? 'data' : (cols.includes('value') ? 'value' : cols[1]);
  const text = JSON.stringify(value || {});

  db.prepare(`INSERT INTO app_data ("${keyCol}", "${dataCol}") VALUES (?, ?)
    ON CONFLICT("${keyCol}") DO UPDATE SET "${dataCol}" = excluded."${dataCol}"`).run(key, text);
}

app.get('/api/plan/:profile', (req, res) => {
  try {
    const user = dpPlanUserFromToken(req);
    const profile = String(req.params.profile || '').trim().toLowerCase();

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Nicht angemeldet' });
    }

    if (!dpPlanCanAccess(user, profile)) {
      return res.status(403).json({ ok: false, error: 'Kein Zugriff auf diesen Dienstplan' });
    }

    const data = dpPlanRead(dpPlanKey(profile));
    if (!data) {
      return res.status(404).json({ ok: false, error: 'Noch kein Dienstplan gespeichert' });
    }

    return res.json(data);
  } catch {
    return res.status(401).json({ ok: false, error: 'Anmeldung ungültig' });
  }
});

app.put('/api/plan/:profile', (req, res) => {
  try {
    const user = dpPlanUserFromToken(req);
    const profile = String(req.params.profile || '').trim().toLowerCase();

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Nicht angemeldet' });
    }

    if (!dpPlanCanAccess(user, profile)) {
      return res.status(403).json({ ok: false, error: 'Kein Zugriff auf diesen Dienstplan' });
    }

    dpPlanWrite(dpPlanKey(profile), req.body || {});
    return res.json({ ok: true });
  } catch {
    return res.status(401).json({ ok: false, error: 'Anmeldung ungültig' });
  }
});

/* DienstPilot Planrechte ENDE */

// Sichere DienstPilot-Einladungen: 48 Stunden, nur einmal verwendbar.
require('./invitation-routes')(app);
app.listen(PORT,'127.0.0.1',function(){
  console.log('DienstPilot API laeuft auf http://127.0.0.1:'+PORT);
});

