# MarketOS Ledger

A professional, offline desktop ledger application for small businesses to manage income and expenses.

## Features

- 📊 Dashboard with real-time financial overview
- 💰 Record income and expense transactions
- 📈 Advanced reporting and analytics
- 🔍 Search, filter, and sort transactions
- 📅 Date range filtering
- 💾 SQLite database for offline operation
- 🔐 Complete data privacy - everything stored locally
- 🎯 Responsive desktop UI with Tailwind CSS
- ⚙️ Business settings and currency support
- 🔄 Database backup and restore
- 📱 Modern, professional design

## Tech Stack

- **Frontend**: React 18 + Vite
- **Desktop**: Electron
- **Styling**: Tailwind CSS
- **Database**: SQLite (better-sqlite3)
- **Date Handling**: Day.js
- **Icons**: React Icons

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd marketOS-ledger
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Development Mode

To run both the Vite dev server and Electron together:

```bash
npm run electron-dev
```

Or run them separately:

**Terminal 1 - Start the Vite dev server:**
```bash
npm run dev
```

**Terminal 2 - Start Electron:**
```bash
npm run electron
```

The application will open automatically.

### Production Build

To build the application for production:

```bash
npm run build
```

To build as an executable:

```bash
npm run electron-build
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Button.jsx
│   ├── Card.jsx
│   ├── Input.jsx
│   ├── Select.jsx
│   ├── Sidebar.jsx
│   ├── SummaryCard.jsx
│   ├── Toast.jsx
│   └── TransactionTable.jsx
├── context/            # React Context (Toast notifications)
├── database/           # Database services
├── hooks/              # Custom React hooks
├── layouts/            # Layout components
├── pages/              # Page components
│   ├── Dashboard.jsx
│   ├── AddIncome.jsx
│   ├── AddExpense.jsx
│   ├── TransactionHistory.jsx
│   ├── Reports.jsx
│   └── Settings.jsx
├── services/           # Business logic services
├── styles/             # Global CSS
├── utils/              # Utility functions
│   ├── constants.js
│   ├── formatters.js
│   └── validators.js
└── App.jsx            # Main app component
electron/
├── main.js            # Electron main process
├── database.js        # SQLite database initialization
├── ipcHandlers.js     # IPC event handlers
└── preload.js         # Preload script for secure IPC
```

## Usage

### Dashboard
- View total income, expenses, and profit/loss
- See today's transactions summary
- Track recent transactions

### Add Income/Expense
- Record new transactions with date, category, amount, and payment mode
- Add optional descriptions
- Validation for all required fields

### Transaction History
- View all transactions in a sortable table
- Search by description or category
- Filter by type and category
- Sort by date or amount
- Edit or delete transactions with confirmation

### Reports
- Generate financial reports for custom date ranges
- Quick preset filters (Today, This Week, This Month, This Year)
- Breakdown by category and date
- Calculate profit margins and averages

### Settings
- Configure business name and owner name
- Choose currency
- Backup database to external file
- Restore from backup
- Reset database (with confirmation)

## Database

The application uses SQLite with the following structure:

### Transactions Table
- id (primary key)
- date
- type (income/expense)
- category
- amount
- payment_mode
- description
- created_at
- updated_at

### Settings Table
- id
- business_name
- owner_name
- currency
- created_at
- updated_at

## Keyboard Shortcuts

- `Ctrl+Q` or `Cmd+Q` - Quit application
- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo

## Data Storage

All data is stored locally in SQLite database at:
- Windows: `%APPDATA%/MarketOS Ledger/ledger.db`
- macOS: `~/Library/Application Support/MarketOS Ledger/ledger.db`
- Linux: `~/.config/MarketOS Ledger/ledger.db`

## Security & Privacy

- No internet connection required
- No data sent to cloud services
- All data stored locally on your computer
- Database can be manually backed up

## Future Enhancements

- Inventory management
- Customer management
- Billing system
- Advanced analytics
- Multi-user support
- Data export (PDF/Excel)
- Mobile app
- Cloud sync (optional)

## License

Proprietary - All rights reserved

## Support

For issues or feature requests, please contact support.

## Changelog

### v1.0.0 (Initial Release)
- Dashboard with financial overview
- Income and expense tracking
- Transaction history with search and filters
- Financial reports with date range filtering
- Settings and database management
- Professional UI with Tailwind CSS
