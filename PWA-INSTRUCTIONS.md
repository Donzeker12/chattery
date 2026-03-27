# Chattery PWA - Installatie Instructies

## ✨ De app is nu een Progressive Web App (PWA)!

Je kunt Chattery nu installeren op je apparaat voor een app-achtige ervaring.

## 📱 Installeren op Mobiel

### Android (Chrome/Edge)
1. Open `http://chattery.test` in Chrome
2. Je ziet automatisch een "Installeer app" banner onderaan
3. Klik op **"Installeren"**
4. Of: Klik op het menu (⋮) → "App installeren" of "Toevoegen aan startscherm"

### iOS (Safari)
1. Open `http://chattery.test` in Safari
2. Tik op het deel-icoon (□↑) onderaan
3. Scroll naar beneden en tik op **"Zet op beginscherm"**
4. Tik op **"Voeg toe"**

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
✅ **Sneller opstarten** - Cached assets laden sneller  
✅ **Offline ondersteuning** - Basis functionaliteit werkt ook offline  
✅ **Push notificaties** - Ontvang meldingen (komt in toekomst)  
✅ **Automatische updates** - App update automatisch bij nieuwe versies  

## 🔧 Voor Developers

### Icons opnieuw genereren
Als je het app icoon wilt aanpassen:

1. Bewerk `public/icon.svg`
2. Voer uit: `npm run generate-icons`
3. Alle PNG icons worden automatisch gegenereerd

### Service Worker
De service worker (`public/sw.js`) zorgt voor:
- Caching strategie (network-first)
- Offline fallback
- Push notificatie ondersteuning

### Manifest
PWA configuratie in `public/manifest.json`:
- App naam, kleuren, display mode
- Icons voor verschillende groottes
- Shortcuts en categorieën

## 🌐 Testen

### Desktop
```bash
# Open in Chrome
chrome --app=http://chattery.test

# Of via Chrome DevTools → Application tab → Manifest
```

### Mobiel via ngrok (voor echte device testing)
```bash
ngrok http 80
# Gebruik de gegenereerde HTTPS URL op je mobiel
```

## 📖 Meer Info

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
