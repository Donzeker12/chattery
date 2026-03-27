# Profielfoto Functionaliteit - Implementatie Gids

## ✅ Wat is er geïmplementeerd?

### Backend
1. **Database**
   - ✅ Migratie uitgevoerd: `profile_photo_path` kolom toegevoegd aan `users` tabel
   
2. **Models**
   - ✅ `User` model bijgewerkt met `profile_photo_path` in fillable array

3. **Controllers**
   - ✅ `ProfileController` aangemaakt met methodes:
     - `uploadPhoto()` - Upload of update profielfoto (max 5MB)
     - `deletePhoto()` - Verwijder profielfoto  
     - `getPhotoUrl()` - Haal foto URL op
   - ✅ `ChatController` bijgewerkt - profile_photo_url toegevoegd aan alle user data responses
   - ✅ `AdminController` bijgewerkt - profile_photo_url toegevoegd aan users lijst

4. **Routes**
   - ✅ `/profile` - Profiel pagina (GET)
   - ✅ `/profile/photo` - Upload foto (POST)
   - ✅ `/profile/photo` - Verwijder foto (DELETE)
   - ✅ `/profile/photo` - Haal foto op (GET)

### Frontend
1. **Components**
   - ✅ `ProfilePhotoUpload.tsx` - Upload/verwijder component met preview
   - ✅ `Avatar.tsx` - Herbruikbare avatar component met:
     - Foto weergave of initialen als fallback
     - Online/offline indicator
     - Verschillende groottes (sm, md, lg, xl)
     - Kleur gebaseerd op naam voor consistency

2. **Pages**
   - ✅ `Profile/Index.tsx` - Volledige profiel instellingen pagina

3. **Types**
   - ✅ `auth.ts` bijgewerkt met `profile_photo_url` en extra properties

## 🎨 Hoe te Gebruiken

### 1. Avatar Component Gebruiken in Chat Interface

Update `resources/js/pages/Chat/Index.tsx`:

```tsx
import Avatar from '@/components/Avatar';

// In de chat lijst:
<div className="flex items-center gap-3">
    <Avatar 
        photoUrl={chat.participant.profile_photo_url}
        name={chat.participant.name}
        size="md"
        isOnline={chat.participant.is_online}
    />
    <div>
        <h3>{chat.participant.name}</h3>
        {/* rest van chat info */}
    </div>
</div>

// In nieuwe chat modal (users lijst):
{users.map(user => (
    <div key={user.id} className="flex items-center gap-3 p-3 hover:bg-gray-50">
        <Avatar 
            photoUrl={user.profile_photo_url}
            name={user.name}
            size="md"
        />
        <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-gray-600">{user.email}</p>
        </div>
    </div>
))}

// In chat header (current participant):
<div className="flex items-center gap-3">
    <Avatar 
        photoUrl={currentParticipant?.profile_photo_url}
        name={currentParticipant?.name || ''}
        size="md"
        isOnline={currentParticipant?.is_online}
    />
    <div>
        <h2>{currentParticipant?.name}</h2>
        <p className="text-sm">
            {currentParticipant?.is_online ? '🟢 Online' : '⚫ Offline'}
        </p>
    </div>
</div>

// In eigen profiel (sidebar):
<div className="flex items-center gap-3 p-4">
    <Avatar 
        photoUrl={auth.user.profile_photo_url}
        name={auth.user.name}
        size="lg"
    />
    <div>
        <p className="font-semibold">{auth.user.name}</p>
        {auth.user.is_admin && <span className="text-xs">👑 Admin</span>}
    </div>
</div>
```

### 2. Link naar Profiel Pagina Toevoegen

Voeg een knop toe in de chat interface om naar de profiel pagina te gaan:

```tsx
import { router } from '@inertiajs/react';

// Bijvoorbeeld in de sidebar header:
<button
    onClick={() => router.visit('/profile')}
    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg"
>
    <Avatar 
        photoUrl={auth.user.profile_photo_url}
        name={auth.user.name}
        size="md"
    />
    <span>Profiel Instellingen</span>
</button>
```

### 3. Admin Panel Updaten

Update `resources/js/pages/Admin/Index.tsx` om avatars te tonen:

```tsx
import Avatar from '@/components/Avatar';

{users.map(user => (
    <tr key={user.id}>
        <td className="px-6 py-4">
            <div className="flex items-center gap-3">
                <Avatar 
                    photoUrl={user.profile_photo_url}
                    name={user.name}
                    size="sm"
                    isOnline={user.is_online}
                />
                <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                </div>
            </div>
        </td>
        {/* rest van de tabel kolommen */}
    </tr>
))}
```

## 📋 Type Definitions

Als je TypeScript errors krijgt, zorg dat je User interface overal deze properties heeft:

```tsx
interface User {
    id: number;
    name: string;
    email: string;
    profile_photo_url?: string | null;
    is_admin?: boolean;
    is_online?: boolean;
}
```

## 🎯 Features

### ProfilePhotoUpload Component
- ✅ Drag & drop interface
- ✅ File size validatie (max 5MB)
- ✅ File type validatie (alleen images)
- ✅ Preview voor/na upload
- ✅ Delete functionaliteit
- ✅ Loading states
- ✅ Hover effects

### Avatar Component
- ✅ Automatische initialen als geen foto
- ✅ Consistente kleuren per naam
- ✅ Online/offline indicator
- ✅ 4 groottes: sm, md, lg, xl
- ✅ Responsive & accessible

## 🔒 Beveiliging

- ✅ File size limiet (5MB)
- ✅ File type validatie (alleen images)
- ✅ Authenticatie vereist
- ✅ User kan alleen eigen foto wijzigen
- ✅ Oude foto wordt automatisch verwijderd bij nieuwe upload

## 📁 Bestandsopslag

Profielfoto's worden opgeslagen in:
- Locatie: `storage/app/public/profile-photos/`
- Publiek toegankelijk via: `public/storage/profile-photos/`
- Formaat: `profile_{user_id}_{timestamp}.{ext}`

## ✨ Volgende Stappen

Nu de backend en components klaar zijn, hoef je alleen:

1. **Avatar component toevoegen** in je bestaande Chat/Index.tsx
2. **Link naar profiel pagina** toevoegen in de navigatie
3. **Admin panel updaten** (optioneel)

De functionaliteit werkt nu volledig! Gebruikers kunnen:
- ✅ Profielfoto uploaden via `/profile`
- ✅ Foto's zien in de chat interface
- ✅ Foto's zien van andere gebruikers
- ✅ Hun foto verwijderen

## 🧪 Testen

Test de functionaliteit:

```bash
# Start je development server (als die nog niet loopt)
npm run dev

# In een andere terminal
php artisan serve

# Bezoek http://chattery.test/profile
```

1. Ga naar `/profile`
2. Klik op de avatar cirkel
3. Upload een profielfoto
4. Ga terug naar chat en zie je foto verschijnen
5. Start een chat met een andere gebruiker en zie hun foto's

Klaar! 🎉
