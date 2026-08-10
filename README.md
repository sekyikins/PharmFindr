# PharmFindr 💊

**AI-Powered Prescription & Pharmacy Assistant**

PharmFindr is a React Native (Expo) mobile application that helps patients understand their prescriptions, search for medicines, locate nearby pharmacies, check medicine availability, and request reservations — all powered by AI, OCR, and geolocation.

---

## Features

### Patient App
- 📷 **Prescription Scanner** — Capture or upload a prescription image; Gemini AI extracts medicine names, dosage, and instructions via OCR.
- 🤖 **AI Chat Assistant** — Ask medicine questions, get dosage guidance, find nearby pharmacies, and request reservations through a conversational interface powered by Google Gemini.
- 🔍 **Medicine Search** — Browse a categorised medicine catalogue with usage, side effects, alternatives, and nearby availability.
- 🗺️ **Nearby Pharmacies** — Full-screen map with real-time pharmacy discovery (OpenStreetMap + Supabase registered pharmacies). Filter by availability.
- 📦 **Reservation System** — Request a medicine reservation at a pharmacy; track acceptance/decline status.
- 🧬 **Health Profile** — Store allergies, chronic conditions, and current medications so the AI can give contextual responses.
- 🔔 **Push Notifications** — Get notified when a pharmacy accepts or declines your reservation.
- 🔒 **Biometric Lock** — Optional Face ID / Fingerprint lock to protect sensitive medical data.
- 🌙 **Dark / Light Mode** — Full theme support with customisable accent colour.

### Pharmacy Dashboard
- 📋 **Inventory Management** — Add, edit, or delete medicines; update stock and prices manually.
- 📤 **Bulk Inventory Upload** — Upload inventory via CSV or Excel (SheetJS).
- ✅ **Reservation Management** — View incoming patient requests and accept or decline with one tap.
- ⏰ **Operating Hours** — Set per-day opening and closing times.
- 🏥 **Pharmacy Profile** — Manage pharmacy info visible to patients.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo SDK 54) |
| Language | TypeScript |
| Navigation | Expo Router v6 (file-based) |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| AI | Google Gemini API (`@google/genai`) |
| Maps | react-native-maps (Google Maps SDK) |
| Routing | OpenRouteService (ORS) |
| Pharmacy Discovery | OpenStreetMap (Overpass API) |
| State Management | Zustand |
| Forms | React Hook Form + Zod |
| Push Notifications | Expo Notifications |
| Biometrics | expo-local-authentication |
| SMS | Arkesel |
| Build & Deploy | Expo EAS |

---

## Project Structure

```
mobile-app/
├── app/                        # Expo Router file-based routes
│   ├── (auth)/                 # Onboarding, login, register, role select
│   ├── (patient)/              # Patient screens
│   │   ├── (tabs)/             # Bottom tab screens: home, search, chat, profile
│   │   ├── pharmacy/[id]/      # Pharmacy detail + in-app navigation
│   │   ├── medicine/[id].tsx   # Medicine details
│   │   ├── reservation/[id].tsx
│   │   ├── ocr-result.tsx
│   │   ├── scan.tsx
│   │   └── ...
│   └── (pharmacy)/             # Pharmacy dashboard screens
│       ├── (tabs)/             # Dashboard, inventory, reservations, profile
│       ├── add-medicine.tsx
│       ├── upload-inventory.tsx
│       └── operating-hours.tsx
├── components/                 # Shared UI components (Button, Toast, Header, etc.)
├── store/                      # Zustand stores (auth, chat, notifications, etc.)
├── lib/                        # Service integrations (Supabase, Gemini, ORS, etc.)
├── context/                    # React contexts (Toast)
├── hooks/                      # Custom hooks
├── styles/                     # Theme tokens (colors, spacing, typography)
├── types/                      # TypeScript type definitions
├── constants/                  # Static data (terms, privacy policy)
├── assets/                     # Fonts, images, icons
├── database/                   # SQL schema + seed scripts (Node.js, not bundled)
└── supabase/                   # Supabase edge functions
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [EAS CLI](https://docs.expo.dev/eas/) (for builds)
- A Supabase project (see [Supabase.md](docs/Supabase.md))

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
EXPO_PUBLIC_ORS_API_KEY=your_openrouteservice_api_key
EXPO_PUBLIC_ARKESEL_API_KEY=your_arkesel_api_key
```

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `EXPO_PUBLIC_GEMINI_API_KEY` | Google Gemini API key |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key (Android + iOS) |
| `EXPO_PUBLIC_ORS_API_KEY` | OpenRouteService API key |
| `EXPO_PUBLIC_ARKESEL_API_KEY` | Arkesel SMS API key |

### 3. Set up the database

Apply the SQL schema to your Supabase project via the Dashboard SQL Editor or psql:

```bash
psql <your-supabase-db-url> < database/schema.sql
```

Optionally seed test data:

```bash
node database/seed.mjs
```

### 4. Run the app

```bash
# Start Expo development server
npm start

# Or target a platform directly
npm run android
npm run ios
```

> **Note:** Features like push notifications, biometrics, and the camera require a real device or development build. Use `eas build --profile development` to create one.

---

## Building for Distribution

### Preview APK (Android sideload)

```bash
eas build --platform android --profile preview
```

### Production Build

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

---

## Key Documentation

- [Project Overview & Requirements](docs/PharmFindr%20(All%20Info).md)
- [MVP Scope](docs/MVP.md)
- [AI Health Assistant Vision](docs/AI_Health_Assistant_Project_Vision.md)
- [Push Notifications Setup](docs/PushNotifications.md)
- [Supabase Setup](docs/Supabase.md)
- [Tech Stack Details](docs/stack.md)

---

## License

MIT — see [LICENSE](LICENSE)
