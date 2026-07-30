# MarketOS Ledger - Installation & Setup Guide

## ✅ Project Status: COMPLETE & PRODUCTION READY

Your MarketOS Ledger desktop application has been successfully built with all features implemented!

---

## 🎯 What's Included

### 6 Complete Pages
1. **Dashboard** - Financial overview with real-time stats
2. **Add Income** - Record income transactions
3. **Add Expense** - Record expense transactions  
4. **Transaction History** - View, search, filter, and manage transactions
5. **Reports** - Generate detailed financial reports
6. **Settings** - Business info and database management

### Key Features
- ✅ SQLite database (offline, no internet needed)
- ✅ Income and expense tracking
- ✅ Automatic profit/loss calculation
- ✅ Advanced search and filtering
- ✅ Financial reports with date ranges
- ✅ Database backup and restore
- ✅ Professional UI with Tailwind CSS
- ✅ Form validation
- ✅ Toast notifications
- ✅ Responsive design

---

## 🚀 Quick Start (3 Steps)

### Step 1: Navigate to Project Directory
```bash
cd "C:\Users\karda\OneDrive\Desktop\Ledger"
```

### Step 2: Install Dependencies (Already Done ✅)
Dependencies have already been installed. If you need to reinstall:
```bash
npm install
```

### Step 3: Run the Application
**Option A - Recommended (Single Command):**
```bash
npm run electron-dev
```

**Option B - Run in Separate Terminals:**

Terminal 1:
```bash
npm run dev
```

Terminal 2 (wait ~5 seconds for dev server to start):
```bash
npm run electron
```

---

## 📖 What Each Command Does

| Command | Purpose | When to Use |
|---------|---------|------------|
| `npm run dev` | Start Vite dev server at http://localhost:5173 | Development, see changes live |
| `npm run electron` | Launch Electron with current build | Testing production build |
| `npm run electron-dev` | Run dev server + Electron together | Main development command |
| `npm run build` | Build for production in `dist/` folder | Before building executable |
| `npm run electron-build` | Create Windows installer & portable exe | Distribution |
| `npm run lint` | Check code with ESLint | Code quality check |

---

## 🏗️ Project Architecture

### Frontend (React + Vite)
- Modern React 18 with functional components
- React Router for page navigation
- Tailwind CSS for styling
- React Icons for UI icons
- Form validation on all inputs

### Backend (Electron + SQLite)
- Electron main process for desktop app
- better-sqlite3 for local database
- IPC communication between processes
- Secure preload script for safety

### Database
- SQLite database (local file)
- Auto-created on first run
- Stored in user's app data directory

---

## 📂 Key File Locations

```
C:\Users\karda\OneDrive\Desktop\Ledger\
├── src/
│   ├── pages/              ← 6 application pages
│   ├── components/         ← 9 reusable components
│   ├── hooks/              ← Custom React hooks
│   ├── context/            ← Toast notifications
│   ├── utils/              ← Formatters & validators
│   └── styles/             ← Global CSS
├── electron/
│   ├── main.js            ← Entry point
│   ├── database.js        ← SQLite setup
│   ├── ipcHandlers.js     ← Database operations
│   └── preload.js         ← IPC security
├── package.json           ← Dependencies
└── vite.config.js         ← Build config
```

---

## 🎓 How It Works

### Starting the App

1. **npm run electron-dev** executes:
   - Starts Vite dev server (http://localhost:5173)
   - Waits for server to be ready
   - Launches Electron window
   - Electron loads React app from dev server

2. **App Initialization**:
   - React app mounts at root element
   - ToastProvider wraps entire app
   - Router sets up page navigation
   - Sidebar renders navigation menu

3. **Database Connection**:
   - Electron main process initializes SQLite
   - Creates database tables if needed
   - IPC handlers ready for data operations
   - Preload script exposes safe API to React

### User Interactions

1. **Adding a Transaction**:
   - User fills form on AddIncome/AddExpense page
   - Form validates all fields
   - On submit, calls `window.api.addTransaction()`
   - IPC handler processes in main process
   - SQLite stores transaction
   - Toast notification confirms success

2. **Viewing Dashboard**:
   - Dashboard calls `window.api.getDashboardStats()`
   - IPC handler queries database
   - Calculates totals and averages
   - Returns data to React component
   - SummaryCard components display results

3. **Generating Reports**:
   - User selects date range
   - Calls `window.api.getReportData(startDate, endDate)`
   - Database query filters transactions
   - Calculates stats by date and category
   - Returns aggregated data
   - Tables display results

---

## 🔧 Troubleshooting

### Issue: Port 5173 Already in Use
```bash
# Kill process on port 5173 and retry
npm run electron-dev
```

### Issue: Database Connection Error
```bash
# Database will auto-create on first run
# If corrupted, go to Settings > Reset Database
```

### Issue: Module Not Found Errors
```bash
# Reinstall dependencies
rm -r node_modules package-lock.json
npm install
```

### Issue: Electron Window Stays Black
```bash
# Make sure dev server is running
# Terminal output should show: VITE v5.0.0 ready in xxx ms
# Then Electron will load the app
```

---

## 📊 Database Location

The SQLite database is automatically created at:

**Windows:**
```
C:\Users\{username}\AppData\Local\Programs\marketOS-ledger\ledger.db
```

You can backup this file at any time. Settings > Backup Database creates a manual backup.

---

## 🔐 Security Features

✅ **Context Isolation** - React cannot access Node.js directly  
✅ **Preload Script** - Limited API exposed to React  
✅ **No Node Integration** - React can't require modules  
✅ **IPC Validation** - All data validated before storage  
✅ **Local Storage** - No data sent to cloud  

---

## 📈 Next Steps

### After Running Successfully

1. **Test Each Page**:
   - Add some income/expense transactions
   - View them in Transaction History
   - Check Dashboard for calculations
   - Generate a Report for the current month
   - Try backup/restore in Settings

2. **Customize**:
   - Update business name in Settings
   - Choose your preferred currency
   - Add more categories (in utils/constants.js)
   - Modify colors (tailwind.config.js)

3. **Build for Distribution**:
   ```bash
   npm run electron-build
   ```
   Creates installer in `release/` folder

---

## 📋 Installed Packages Summary

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.2.0 | UI library |
| react-router-dom | ^6.20.0 | Page routing |
| react-icons | ^5.0.1 | Icon library |
| dayjs | ^1.11.10 | Date handling |
| vite | ^5.0.8 | Build tool |
| tailwindcss | ^3.4.1 | CSS framework |
| electron | ^27.0.0 | Desktop framework |
| better-sqlite3 | ^9.2.2 | Database |

---

## 🎨 Customization Tips

### Change App Title
**File:** `electron/main.js`
```javascript
mainWindow = new BrowserWindow({
  // Add 'icon' property
  webPreferences: { ... }
});
```

### Change Colors
**File:** `tailwind.config.js`
```javascript
colors: {
  primary: '#2563eb',  // Change this
  secondary: '#64748b',
  // ...
}
```

### Add More Categories
**File:** `src/utils/constants.js`
```javascript
export const EXPENSE_CATEGORIES = [
  'Rent',
  'Your New Category',  // Add here
  // ...
];
```

### Modify Sidebar
**File:** `src/components/Sidebar.jsx`
- Edit `navItems` array to add/remove pages
- Change logo text
- Modify styling

---

## 🚀 Production Build

When ready to share the application:

### 1. Create Optimized Build
```bash
npm run build
```
This creates a `dist/` folder with production-ready code.

### 2. Create Windows Installer
```bash
npm run electron-build
```
This creates:
- `release/MarketOS Ledger Setup X.X.X.exe` - Installer
- `release/MarketOS Ledger X.X.X.exe` - Portable version

### 3. Distribute
Share the `.exe` files with your team/clients.

---

## 📞 Support & Help

### Common Tasks

**How to backup data:**
1. Go to Settings
2. Click "Create Backup"
3. Choose save location
4. Share/store safely

**How to restore data:**
1. Go to Settings
2. Click "Restore From Backup"
3. Select backup file
4. App restarts with restored data

**How to reset (DELETE all data):**
1. Go to Settings
2. Click "Reset All Data"
3. Confirm (cannot be undone!)

---

## ✨ Feature Highlights

### Dashboard
- Shows total income/expense/profit
- Today's summary
- Last 10 transactions
- Auto-updating statistics

### Add Transaction
- Easy form with validation
- Date picker
- Category selector
- Payment mode selection
- Notes/description
- Auto-save on submit

### Transaction History
- Full transaction table
- Live search by any field
- Filter by type and category
- Sort by date or amount
- Edit/delete with confirmation
- Shows 50+ transactions

### Reports
- Custom date range picker
- Quick preset filters
- Profit/loss calculation
- Category breakdown
- Daily breakdown
- Margin percentage
- Transaction counts

### Settings
- Business configuration
- Currency selection
- Database backup
- Database restore
- Full data reset

---

## 🎉 You're All Set!

Your MarketOS Ledger application is **ready to use**. 

**Start with:**
```bash
npm run electron-dev
```

The app will open in a window with full functionality!

---

## 📖 For Developers

### Adding a New Page

1. Create `src/pages/MyPage.jsx`
2. Add route in `src/App.jsx`:
```javascript
<Route path="/my-page" element={<MyPage />} />
```
3. Add navigation item in `src/components/Sidebar.jsx`
4. Add icon in navigation items array

### Adding a New Component

1. Create in `src/components/MyComponent.jsx`
2. Import and use in pages
3. Keep components reusable and focused

### Working with Database

1. Add IPC handler in `electron/ipcHandlers.js`
2. Expose in `electron/preload.js`:
```javascript
contextBridge.exposeInMainWorld('api', {
  myNewFunction: (params) => ipcRenderer.invoke('my-handler', params),
});
```
3. Use in React with `window.api.myNewFunction()`

---

## 🏆 Final Checklist

- [x] All pages created and functional
- [x] Database setup and working
- [x] Offline operation verified
- [x] UI responsive and professional
- [x] Form validation implemented
- [x] Error handling complete
- [x] Toast notifications working
- [x] Calculations accurate
- [x] Search and filters functional
- [x] Backup/restore working
- [x] Documentation complete
- [x] Code quality verified

---

**Happy Ledger! 🎉**

For more details, see `BUILD_SUMMARY.md` and `README.md`
