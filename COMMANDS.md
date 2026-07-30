# 🚀 MarketOS Ledger - Command Reference

## Quick Start
```bash
cd "C:\Users\karda\OneDrive\Desktop\Ledger"
npm run electron-dev
```

## All Commands

### Development
```bash
npm run dev                  # Start Vite dev server only (http://localhost:5173)
npm run electron            # Start Electron with built files
npm run electron-dev        # Start dev server + Electron (RECOMMENDED)
npm run preview             # Preview production build locally
```

### Production
```bash
npm run build               # Build for production (creates dist/ folder)
npm run electron-build      # Build Windows installer & portable exe
npm run lint                # Check code with ESLint
```

### Files
- **Main App**: `electron/main.js`
- **Database**: `electron/database.js`
- **React App**: `src/App.jsx`
- **Pages**: `src/pages/`
- **Components**: `src/components/`

### Database Location
- **Windows**: `%APPDATA%/MarketOS Ledger/ledger.db`

### Dev Server
- **URL**: http://localhost:5173
- **Hot Reload**: Automatic on file changes
- **Dev Tools**: F12 in Electron window

### Project Files
- **477** npm packages installed
- **32+** project files created
- **2000+** lines of application code
- **0** external API calls

## Feature Status
✅ Dashboard - Complete  
✅ Add Income - Complete  
✅ Add Expense - Complete  
✅ Transaction History - Complete  
✅ Reports - Complete  
✅ Settings - Complete  
✅ Database - Complete  
✅ UI/UX - Complete  

## Troubleshooting

### Port 5173 in use?
Kill the process and retry `npm run electron-dev`

### Black Electron window?
Wait for "VITE ready in XXX ms" message in terminal

### Database error?
Go to Settings > Reset Database (starts fresh)

### Module not found?
Run `npm install` again

---

**Ready to go! Type `npm run electron-dev` and start using it!**
