# Chattery PWA - Installatie Instructies

## ✨ De app is nu een volwaardige Progressive Web App (PWA)!

Je kunt Chattery nu installeren op je apparaat voor een native app-achtige ervaring.

## 📱 Installeren op Mobiel

### Android (Chrome/Edge)
1. Open `http://chattery.test` in Chrome
2. Je ziet automatisch een intelligente "Installeer app" prompt na enkele seconden
3. Klik op **"🚀 Installeren"**
4. Of: Klik op het menu (⋮) → "App installeren" of "Toevoegen aan startscherm"

### iOS (Safari)
1. Open `http://chattery.test` in Safari
2. Tik op het deel-icoon (□↑) onderaan
3. Scroll naar beneden en tik op **"Zet op beginscherm"**
4. Tik op **"Voeg toe"**
5. **Nieuw!** Je krijgt nu mooie splash screens bij het opstarten

## 💻 Installeren op Desktop

### Chrome/Edge (Windows/Mac/Linux)
1. Open `http://chattery.test`
2. Klik op het installatie-icoon (⊕) in de adresbalk
3. Of: Klik op menu (⋮) → "Chattery installeren"
4. Klik op **"Installeren"**

### Safari (Mac)
1. Open `http://chattery.test`
2. Klik op Bestand → "Voeg toe aan Dock"

## 🎯 Voordelen van de PWA

✅ **Werkt zonder browser chrome** - Geen adresbalk, voelt als native app  
✅ **Eigen app icoon** - Chattery heeft een eigen app icoon op je apparaat  
✅ **Sneller opstarten** - Intelligente caching strategie voor snelheid  
✅ **Offline ondersteuning** - Werkt ook zonder internet met cached content  
✅ **iOS Splash Screens** - Mooie opstartschermen op alle iPhone/iPad modellen  
✅ **Slimme install prompt** - Toont alleen wanneer relevant  
✅ **Push notificaties** - Ontvang meldingen (komt in toekomst)  
✅ **Automatische updates** - App update automatisch bij nieuwe versies  
✅ **Offline fallback** - Speciale offline pagina als er geen internet is  

## 🔧 Voor Developers

### Icons en Splash Screens opnieuw genereren
Als je het app icoon wilt aanpassen:

1. Bewerk `public/icon.svg`
2. Voer uit: `npm run generate-icons`
3. Alle PWA assets worden automatisch gegenereerd:
   - 8 PWA icons (72x72 tot 512x512)
   - Favicon en Apple Touch Icon  
   - 7 iOS splash screens voor verschillende apparaten

### Service Worker - Geavanceerde Caching
De service worker (`public/sw.js`) heeft nu:
- **Network First** strategie voor API calls (snelle updates)
- **Cache First** voor images (snelle laadtijden)
- **Stale While Revalidate** voor CSS/JS (beste van beide werelden)
- **Intelligent caching** op basis van bestandstype
- **Offline fallback** naar `/offline.html`
- **Automatic cache cleanup** bij updates

### PWA Install Prompt - Slim Gedrag
De install prompt (`PWAInstallPrompt.tsx`) heeft:
- **Smart timing** - toont pas na 3 seconden
- **Respectful dismissal** - herinnert pas na 7 dagen
- **Installation detection** - verbergt zich als app al geïnstalleerd is
- **Local storage** - onthoudt gebruikersvoorkeuren
- **Visual benefits** - toont concrete voordelen met iconen

### Manifest - Complete Configuratie
PWA configuratie in `public/manifest.json`:
- Nederlandse namen en beschrijvingen
- Complete icon set voor alle apparaten
- Shortcuts naar belangrijke functies
- Screenshots voor app stores (toekomst)
- Juiste categorieën en thema kleuren

### Offline Support
- **Offline pagina** (`/offline.html`) met mooie styling
- **Auto-retry** functie wanneer internet terugkomt
- **Cached content** blijft beschikbaar zonder internet
- **Network status detection** voor slimme fallbacks

## 🌐 Testen

### Desktop PWA Testen
```bash
# Open als standalone app
chrome --app=http://chattery.test

# Of via Chrome DevTools
F12 → Application tab → Manifest → Test installability
```

### Mobiel Testen via Ngrok
```bash
# Voor echte device testing met HTTPS
ngrok http 80
# Gebruik de gegenereerde HTTPS URL op je mobiel
```

### Service Worker Debuggen
```bash
# Chrome DevTools
F12 → Application → Service Workers
# Bekijk cache, update service worker, test offline mode
```

## 🚀 Recent Toegevoegde Features

### v4.0 Updates:
- ✨ **iOS Splash Screens** - Mooie opstartschermen voor alle Apple apparaten
- 🧠 **Slimme Install Prompt** - Respecteert gebruikersgedrag  
- ⚡ **Geavanceerde Caching** - Verschillende strategieën per bestandstype
- 🌐 **Offline Pagina** - Elegante fallback zonder internet
- 📱 **Betere PWA Meta Tags** - Ondersteuning voor meer platforms
- 🎨 **Screenshots Support** - Klaar voor app store listings

### Performance Optimalisaties:
- Stale-while-revalidate voor CSS/JS assets
- Network-first voor API calls (realtime data)
- Cache-first voor images (snelle laadtijden)
- Automatic cache versioning en cleanup

## 📖 Meer Info

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [PWA Install Patterns](https://web.dev/promote-install/)

---

**🎉 Je Chattery app is nu een volledig werkende PWA met alle moderne features!**
