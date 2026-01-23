# 📋 Akční Plán - Co Dělat Teď

Toto je krok-za-krokem plán, co dělat se svým novým Docker setupem.

---

## 🎯 Fáze 1: Okamžitě (Dnes)

### 1.1 Ověř instalaci Docker Desktop
```bash
# V terminálu/PowerShellu
docker --version
docker-compose --version
```

**Pokud selže:**
→ Instaluj Docker Desktop: https://www.docker.com/products/docker-desktop

### 1.2 Spustí server
```bash
cd C:\Projects\mcp-fe
docker-compose up --build
```

**Mělo by:**
- Buildovat image (~2-5 minut)
- Startovat server
- Zobrazit: "MCP Server (HTTP/WS) starting on port 3001..."

### 1.3 Testuj server
```bash
# V jiném terminálu
curl http://localhost:3001
```

**Nebo:**
- Otevři: http://localhost:3001 v prohlížeči

### 1.4 Zastaví server
```bash
# V terminálu se serverem
Ctrl + C

# Nebo v jiném terminálu
docker-compose down
```

**Status**: ✅ HOTOVO

Pokud všechno funguje, jsi připravený na fázi 2! 🎉

---

## 🔄 Fáze 2: Publikování (Dnes/Zítřá)

### 2.1 Commitni nové soubory
```bash
cd C:\Projects\mcp-fe

# Zkontroluj co se změnilo
git status

# Přidej Docker soubory
git add .github/workflows/ \
        apps/mcp-server/Dockerfile \
        apps/mcp-server/.dockerignore \
        .dockerignore \
        docker-compose.yml \
        docker-compose.dev.yml \
        docker-compose.prod.yml \
        nginx.conf.example \
        docker-setup.sh \
        docker-setup.bat \
        README_DOCKER.md \
        DOCKER_SETUP.md \
        DOCKER_INDEX.md \
        DOCKER_CHECKLIST.md \
        DEPLOYMENT.md \
        DOCKER_QUICK_REFERENCE.md \
        DOCKER_COMPLETE_OVERVIEW.md \
        DOCKER_INSTALLATION_COMPLETE.md \
        DOCKER_VISUAL_SUMMARY.md
```

### 2.2 Vytvoř commit
```bash
git commit -m "feat: Add complete Docker setup for mcp-server

- Add Dockerfile with multi-stage build
- Add docker-compose configurations (dev, prod)
- Add GitHub Actions CI/CD workflows
- Add Nginx reverse proxy configuration
- Add comprehensive documentation
- Add helper scripts for Windows and Linux/Mac
- Include security scanning and health checks"
```

### 2.3 Pushni na GitHub
```bash
git push origin main
```

**GitHub Actions se spustí automaticky!**

### 2.4 Sleduj GitHub Actions
1. Jdi na: https://github.com/YOUR_REPO/actions
2. Klikni na nejnovější workflow run
3. Sleduj: `docker-publish` workflow
4. Měl by projít bez chyb ✅

**Status**: ✅ HOTOVO když:
- Build projde bez chyb
- Image se publishnul na ghcr.io
- Security scan má 0 CRITICAL issues

---

## 🚀 Fáze 3: Produkční Nasazení (Příští týden)

### 3.1 Připrav produkční server

**Požadavky:**
- Linux server (Ubuntu, Debian, atd.)
- SSH přístup
- Root nebo sudo přihlášení

**Instalace Docker:**
```bash
# SSH do serveru
ssh user@your-server.com

# Instaluj Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ověř instalaci
docker --version
```

### 3.2 Klonuj/stáhni potřebné soubory
```bash
# Vytvoř adresář
mkdir -p /home/user/mcp-server
cd /home/user/mcp-server

# Možnost A: Klonuj celý repo
git clone https://github.com/YOUR_REPO/mcp-fe .

# Možnost B: Jen stáhni potřebné soubory
wget https://raw.githubusercontent.com/YOUR_REPO/mcp-fe/main/docker-compose.prod.yml
wget https://raw.githubusercontent.com/YOUR_REPO/mcp-fe/main/nginx.conf.example -O nginx.conf
```

### 3.3 Nastav environmentální proměnné
```bash
# Vytvoř .env soubor
cat > .env << EOF
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
EOF
```

### 3.4 Spusť server v produkci
```bash
# Login do GitHub Container Registry
docker login ghcr.io
# Username: YOUR_GITHUB_USERNAME
# Password: YOUR_GITHUB_PAT_TOKEN (ne heslo!)

# Spustí server
docker-compose -f docker-compose.prod.yml up -d

# Ověř
docker-compose -f docker-compose.prod.yml ps

# Logy
docker-compose -f docker-compose.prod.yml logs -f
```

**Status**: ✅ HOTOVO když:
- Všechny services běží (ps command)
- Logy jsou bez errors
- Server je dostupný na portu 80/443

### 3.5 (Volitelně) Nastav SSL s Let's Encrypt
```bash
# Instaluj Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generuj certifikát
sudo certbot certonly --standalone -d your-domain.com

# Aktualizuj nginx.conf s cestami k certifikátům
nano nginx.conf

# Reload nginx
docker exec <nginx-container> nginx -s reload
```

---

## 📚 Fáze 4: Údržba a Monitoring (Průběžně)

### 4.1 Běžná Údržba

**Denně:**
```bash
# Zkontroluj zdraví
docker-compose ps

# Podívej se na logy
docker-compose logs --tail=50
```

**Týdně:**
```bash
# Aktualizuj na novou verzi
docker-compose pull
docker-compose up -d

# Čistka staých images
docker image prune -a
```

**Měsíčně:**
```bash
# Full system cleanup
docker system prune -a

# Review logs
docker logs <container> --since 30m
```

### 4.2 Monitoring a Alerting

Zvažuj přidání:
- [ ] Prometheus + Grafana (metriky)
- [ ] ELK Stack nebo Loki (centrální logy)
- [ ] Alerting (PagerDuty, Slack)
- [ ] Uptime monitoring (Healthchecks.io)

**Doporučené:**
→ `DEPLOYMENT.md` - Monitoring a údržba

### 4.3 Backups a Disaster Recovery

Nastav:
- [ ] Regular backups dat/databází
- [ ] Backup configuration soubory
- [ ] Test restoration procedure
- [ ] Document recovery steps

---

## 🔍 Fáze 5: Optimalizace (Později)

### 5.1 Performance Tuning
- [ ] Optimalizuj image velikost
- [ ] Analyzuj build časy
- [ ] Implementuj layer caching
- [ ] Review resource limits

### 5.2 Security Hardening
- [ ] Regular Trivy scans
- [ ] Update base images
- [ ] Review GitHub Actions permissions
- [ ] Implement signing for images

### 5.3 Scalability
- [ ] Load testing
- [ ] Horizontal scaling preparation
- [ ] Database connection pooling
- [ ] Review for Kubernetes readiness

---

## ✅ Checklist - Krok za Krokem

### FÁZE 1: Lokální Testování
- [ ] Docker Desktop nainstalován
- [ ] `docker-compose up --build` úspěšné
- [ ] Server běží na localhost:3001
- [ ] Zastavil jsem server (`docker-compose down`)

### FÁZE 2: Publikování na GitHub
- [ ] Commitnul jsem všechny soubory
- [ ] Pushnul jsem na main branch
- [ ] GitHub Actions se spustily
- [ ] `docker-publish` workflow prošel
- [ ] Image je na ghcr.io
- [ ] Security scan projel bez CRITICAL errors

### FÁZE 3: Produkční Nasazení
- [ ] Server má Docker nainstalovaný
- [ ] Ssh přístup je nastavený
- [ ] `docker-compose.prod.yml` je na serveru
- [ ] nginx.conf je nakonfigurovaný
- [ ] Server běží v produkci
- [ ] Health checks jsou v pořádku
- [ ] Logy vypadají zdravě

### FÁZE 4: Údržba
- [ ] Monitorování je nastavené
- [ ] Alerting je nastavený
- [ ] Backups jsou nastaveny
- [ ] Testoval jsem recovery proces

### FÁZE 5: Optimalizace
- [ ] Performance je OK
- [ ] Security je reviewed
- [ ] Scalability je plánovaná

---

## 🚨 Co Dělat Když Něco Nejde

### Docker se nespustí
→ `DEPLOYMENT.md` - Troubleshooting sekce
→ Zkontroluj: `docker-compose logs -f`

### GitHub Actions selhal
→ Jdi na: GitHub → Actions tab
→ Klikni na failed workflow
→ Čti error logy

### Produkční server se vypne
→ SSH do serveru
→ `docker-compose logs -f`
→ Čti `DEPLOYMENT.md` - Troubleshooting

### Potřebuji pomoc s příkazem
→ `DOCKER_QUICK_REFERENCE.md` - Cheat sheet

### Nevím co dělat
→ `DOCKER_INDEX.md` - Situace a řešení

---

## 📞 Užitečné Linky

- Docker Docs: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- GitHub Container Registry: https://github.com/features/packages
- GitHub Actions: https://github.com/features/actions
- Let's Encrypt: https://letsencrypt.org/

---

## 💡 Tipy

1. **Vždy loguj**: `docker-compose logs -f` je tvůj nejlepší přítel
2. **Testuj lokálně**: Před pushem na produkci
3. **Verzuj images**: Semantic versioning (v1.0.0)
4. **Dokumentuj**: Měj README pro svůj setup
5. **Monitoruj**: Zdravé kontejnery jsou důležité
6. **Backupuj**: Vždy maj plan B
7. **Čistij**: Regular `docker system prune`

---

## 📈 Progression

```
[████████████████████████████████████] 100%

Fáze 1: Lokální testování         HOTOVO ✅
Fáze 2: Publikování na GitHub     HOTOVO ✅
Fáze 3: Produkční nasazení        PŘIPRAVENO (příští týden)
Fáze 4: Údržba                    PŘIPRAVENO (průběžně)
Fáze 5: Optimalizace              PŘIPRAVENO (později)
```

---

## 🎉 To je vše!

Máš kompletní akční plán pro:
1. ✅ Lokální vývoj
2. ✅ Automatické publikování
3. ✅ Produkční nasazení
4. ✅ Údržbu a monitoring
5. ✅ Budoucí optimalizaci

---

## 🚀 Začni Teď

**Hned teď:**
```bash
docker-compose up --build
```

**Pak:**
```bash
git push origin main
```

**A pak:**
```bash
# Příští týden na produkčním serveru
docker-compose -f docker-compose.prod.yml up -d
```

---

**Status: PŘIPRAVENÝ K AKCI** 🚀

Pokud máš otázky, čti si relevantní dokumentaci nebo spusť helper script.

**Hodně štěstí!** 💪
