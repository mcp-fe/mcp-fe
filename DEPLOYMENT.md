# MCP Server - Návod na Nasazení

Komplétní průvodce nasazením mcp-server jako Docker image.

## 📋 Obsah

1. [Rychlý start](#-rychlý-start)
2. [Lokální testování](#-lokální-testování)
3. [CI/CD Pipeline](#-cicd-pipeline)
4. [Nasazení do produkce](#-nasazení-do-produkce)
5. [Monitoring a údržba](#-monitoring-a-údržba)
6. [Troubleshooting](#-troubleshooting)

---

## 🚀 Rychlý start

### Nejrychlejší způsob - Docker Compose

```bash
# 1. Z root adresáře projektu
cd /path/to/mcp-fe

# 2. Spusť server v Docker kontejneru
docker-compose up --build

# 3. Server je dostupný na http://localhost:3001
```

Hotovo! Kontejner se automaticky builduje a startuje.

---

## 🧪 Lokální testování

### Třemi způsoby, jak testovat Docker image:

#### 1️⃣ Docker Compose (Doporučeno pro vývoj)

```bash
# Spustit desenvolvimento
docker-compose -f docker-compose.dev.yml up

# Spustit produkčně s nginx
docker-compose -f docker-compose.prod.yml up
```

#### 2️⃣ Manuální Docker build

```bash
# Build image
docker build -t mcp-server:latest -f apps/mcp-server/Dockerfile .

# Spustit kontejner
docker run -p 3001:3001 \
  --name mcp-server \
  -e NODE_ENV=production \
  mcp-server:latest

# Zastavit
docker stop mcp-server
docker rm mcp-server
```

#### 3️⃣ Příkazy pro debugging

```bash
# Spustit s interaktivním shellem
docker run -it -p 3001:3001 mcp-server:latest /bin/sh

# Zobrazit logy běžícího kontejneru
docker logs -f <container-id>

# Vstoupit do běžícího kontejneru
docker exec -it <container-id> /bin/sh

# Zobrazit statistiky
docker stats
```

---

## 🔄 CI/CD Pipeline

Projekt je nastavený na automatické buildování a publikování.

### GitHub Actions Workflow

Umístění: `.github/workflows/docker-publish.yml`

**Automatické triggerování:**
- Push na `main` nebo `develop`
- Pull request
- Ručně (workflow_dispatch)

**Co se děje:**
1. ✅ Build Docker image
2. 📦 Publikování na GitHub Container Registry (ghcr.io)
3. 🏷️ Automatické tagging
4. 🔒 Security scan (Trivy)

### Publikování verze

```bash
# Vytvoř git tag
git tag v1.0.0

# Push tag
git push origin v1.0.0

# GitHub Actions automaticky:
# - Builduje image
# - Publikuje jako ghcr.io/.../mcp-server:v1.0.0
# - Publikuje jako ghcr.io/.../mcp-server:latest
```

### Stavy workflow

Zkontroluj průběh na: `GitHub -> Actions tab`

---

## 🌐 Nasazení do produkce

### Předpoklady

- Server s nainstalovaným Docker a Docker Compose
- Přístup k GitHub Container Registry (ghcr.io)
- Doménu pro server (volitelně)
- SSL certifikáty (pro HTTPS)

### Krok 1: Příprava serveru

```bash
# SSH do serveru
ssh user@your-server.com

# Instalace Docker (pokud není)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalace Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Ověření instalace
docker --version
docker-compose --version
```

### Krok 2: Klonování / Setup

```bash
# Vytvoř pracovní adresář
mkdir -p /home/user/mcp-server
cd /home/mcp-server

# Klonuj repozitář (nebo jen stáhni docker-compose.prod.yml)
git clone <your-repo> .

# Nebo alternativně stáhni jen potřebné soubory
wget https://raw.githubusercontent.com/<user>/<repo>/main/docker-compose.prod.yml
wget https://raw.githubusercontent.com/<user>/<repo>/main/nginx.conf.example -O nginx.conf
```

### Krok 3: Konfigurace

```bash
# Vytvoř .env soubor (pokud je třeba)
cat > .env << EOF
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
EOF

# Upravit nginx.conf (pokud chceš SSL, custom doménu, atd.)
nano nginx.conf
```

### Krok 4: Spuštění

```bash
# Login do GitHub Container Registry
docker login ghcr.io
# Zadej GitHub username a PAT token (Personal Access Token)

# Stáhni a spusť nejnovější verzi
docker-compose -f docker-compose.prod.yml up -d

# Ověření
docker-compose -f docker-compose.prod.yml ps

# Logy
docker-compose -f docker-compose.prod.yml logs -f mcp-server
```

### Krok 5: SSL/HTTPS Setup (doporučeno)

Použij **Let's Encrypt** s Certbot:

```bash
# Instalace
sudo apt-get install certbot python3-certbot-nginx

# Generování certifikátu
sudo certbot certonly --standalone -d your-domain.com

# Uprav nginx.conf a odkomentuj SSL sekci
# Zkopíruj cesty do certifikátů

# Reload nginx
docker exec <nginx-container> nginx -s reload
```

### Krok 6: Monitoring a Auto-restart

```bash
# Docker service se automaticky restartuje (restart: always)

# Pro systémový monitoring (systemd):
sudo cat > /etc/systemd/system/mcp-server.service << EOF
[Unit]
Description=MCP Server Docker Compose
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/user/mcp-server
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Povolení a start
sudo systemctl daemon-reload
sudo systemctl enable mcp-server
sudo systemctl start mcp-server
```

---

## 📊 Monitoring a údržba

### Zdravostní kontroly

```bash
# Zkontrolovat status
docker-compose -f docker-compose.prod.yml ps

# Zdravotní test
curl http://localhost:3001/health

# Full diagnostika
docker-compose -f docker-compose.prod.yml logs --tail=50 mcp-server
```

### Aktualizace na novou verzi

```bash
# Stáhni nový image
docker-compose -f docker-compose.prod.yml pull

# Restartuj s novým image
docker-compose -f docker-compose.prod.yml up -d

# Ověření
docker-compose -f docker-compose.prod.yml ps
```

### Čištění (vyčistit staré image/kontejnery)

```bash
# Zastavit všechny
docker-compose -f docker-compose.prod.yml down

# Smazat nepoužívané image
docker image prune -a

# Smazat volume (DATA LOSS!)
docker volume prune
```

### Logování a debugging

```bash
# Real-time logy
docker-compose -f docker-compose.prod.yml logs -f

# Logy jen mcp-server
docker-compose -f docker-compose.prod.yml logs -f mcp-server

# Poslední 100 řádků
docker-compose -f docker-compose.prod.yml logs --tail=100

# S timestampem
docker-compose -f docker-compose.prod.yml logs -f --timestamps
```

---

## ❌ Troubleshooting

### Kontejner se hned vypne

```bash
# Zkontroluj logy
docker-compose up --build

# Hledej chyby v výstupu
```

**Řešení:**
- Ověř, že `main.ts` správně startuje
- Zkontroluj environmentální proměnné
- Zkontroluj porty (není-li něco jiného na portu 3001)

### Port je již používán

```bash
# Zjisti, co port používá
lsof -i :3001  # Linux/Mac
netstat -ano | findstr :3001  # Windows

# Řešení: Změň port v docker-compose.yml
# "3002:3001" místo "3001:3001"
```

### Build selhal s "pnpm: not found"

Dockerfile to má řešit, ale pokud se to stane:

```bash
# Zkontroluj Dockerfile
cat apps/mcp-server/Dockerfile | grep pnpm

# Mělo by být:
# RUN npm install -g pnpm
```

### Image je moc velký

```bash
# Multi-stage build už to optimalizuje
# Pro další optimalizaci:

# 1. Smaž .git, node_modules z .dockerignore
# 2. Minimalizuj build stage
# 3. Použij Alpine Linux (už použitý v base image)

# Kontrola velikosti
docker images | grep mcp-server
```

### Kontejner se nepřipojuje k WebSocket

Zkontroluj:
1. Nginx konfigurace (upgrade headers)
2. Firewall pravidla
3. Proxy nastavení

```bash
# Ověř WebSocket v nginx.conf:
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection "upgrade";
```

### GitHub Actions workflow selhal

1. Zkontroluj `Actions` tab na GitHubu
2. Zkontroluj `GITHUB_TOKEN` permissions
3. Zkontroluj `docker-publish.yml` syntaxi
4. Spusť ručně pro debugging: "Run workflow"

---

## 📚 Další zdroje

- [Docker dokumentace](https://docs.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Nginx dokumentace](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)

---

## ✅ Kontrolní seznam

Před pushem do produkce:

- [ ] Otestuj lokálně s `docker-compose up`
- [ ] Zkontroluj `DOCKER_SETUP.md` a `DEPLOYMENT.md`
- [ ] Ověř environmentální proměnné
- [ ] Testuj GitHub Actions workflow na develop branchi
- [ ] Zkontroluj security scan výsledky
- [ ] Připrav nginx konfiguraci
- [ ] Připrav SSL certifikáty
- [ ] Dokumentuj deployment procesu
- [ ] Nastavuj monitoring a alerting
- [ ] Testuj failover a disaster recovery scénáře

---

**Hotovo! 🎉 Máš kompletní Docker setup pro mcp-server.**
