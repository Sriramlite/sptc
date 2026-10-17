# Subramanian Polytechnic College (SPTC), Rayavaram
## Official Web Portal & Cloud Students Fees Management System (Replacing Legacy Tally)

[![Node.js](https://img.shields.io/badge/Node.js-v24+-green.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.21-blue.svg)](https://expressjs.com)
[![DOTE Institution Code](https://img.shields.io/badge/DOTE%20Code-331-gold.svg)](https://sptc.org.in)
[![AICTE Approved](https://img.shields.io/badge/AICTE-Approved-navy.svg)](https://aicte-india.org)

---

## 📖 Overview

This repository contains the complete full-stack web application for **Subramanian Polytechnic College (SPTC)**, located in Rayavaram, Pudukkottai District, Tamil Nadu.

The system addresses two major requirements:
1. **Institutional Web Portal**: Modern, mobile-responsive showcase for the 40+ year-old polytechnic college, featuring all 6 diploma engineering departments, 12-acre campus facilities, AICTE/DOTE regulatory compliance, and online admission enquiry with direct WhatsApp routing.
2. **Cloud Students Fees Management System (FMS)**: Replacing the vulnerable, outdated standalone desktop Tally PC with a multi-user, centralized web ledger. Each and every student can log in, view live semester fee breakdowns, check dues, pay online via UPI/Card, and download official historical and current receipts equipped with tamper-proof QR code verification.

---

## 🚀 Quick Start Guide

### 1. Install & Run
```bash
# Navigate to the project root
cd f:\sriramprojects\sptc

# Install dependencies (Express, CORS)
npm install

# Start the application server
npm start
```

The portal will be live at:
👉 **`http://localhost:3000`**

---

## 🔑 Sample Student Credentials for Testing

Use any of the following pre-loaded student profiles to test the Student Fees Vault:

| DOTE Reg No | Student Name | Department | Year / Sem | Quota / Transport | Balance Due | Old Tally Receipts in Vault |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`22201045`** | K. Vigneshwaran | Computer Engineering | III Year (6th Sem) | Day Scholar (Pudukkottai Route #3) | ₹21,400 | **4 Legacy Tally + 1 Web** |
| **`22202018`** | M. Priya Dharshini | ECE | III Year (6th Sem) | Hosteller (Govt. BC/MBC Scholarship) | ₹28,150 | **1 Migrated + 1 Web** |
| **`23203009`** | S. Karthikeyan | Mechanical Engineering | II Year (4th Sem) | Day Scholar (Karaikudi Route #5) | ₹26,300 | **1 Legacy Tally** |
| **`23204014`** | R. Anitha | EEE | II Year (4th Sem) | Day Scholar (Thirumayam Route #2) | ₹0 (Paid) | **1 Tally XML Synced** |
| **`24205003`** | A. Saravanan | Civil Engineering | I Year (2nd Sem) | Hosteller (First Gen Graduate) | ₹27,200 | **1 Cashier POS** |

> *Default PIN / DOB:* `12052005` (or click the **"Quick Switch Student"** dropdown in the top bar to switch instantly).

---

## 🏛️ Core Features

### 1. Public College Portal
- **Rich Visual Identity**: Academic Deep Navy (`#0A2558`), Regal Gold (`#D4AF37`), and Clean Snow White (`#FFFFFF`).
- **Live Announcements Ticker**: Real-time college notices, examination schedules, and scholarship deadlines.
- **6 Diploma Disciplines**:
  - Department of Computer Engineering
  - Department of Mechanical Engineering
  - Department of Electrical & Electronics Engineering (EEE)
  - Department of Electronics & Communication Engineering (ECE)
  - Department of Civil Engineering
  - Department of Basic Engineering (First Year Foundation)
- **Campus & Facilities**: MAM Palaniappa Chettiar Auditorium, Selva Vinayagar Temple, Central Library (10,000+ volumes), Boys & Girls Hostels, and College Bus fleet routes (Pudukkottai, Karaikudi, Thirumayam, Aranthangi).
- **Statutory Compliance**: AICTE EOA reports, DOTE Code 331 Mandatory Disclosures, Anti-Ragging Committee helpline, and Online Grievance Redressal.

### 2. Student Fees & Receipts Vault
- **Live Financial Summary**:
  - Total Course Billed across all 6 semesters.
  - Total Amount Paid to date.
  - Net Outstanding Balance Due & Next Payment Due Date.
  - Government Scholarship & First Generation Graduate (FGG) fee concessions credited.
- **Semester Ledger Breakdown**:
  - Tuition, Laboratory/Workshop, DOTE Exam, Bus Transport, and Hostel/Mess itemized fees.
- **Official Digital Receipts Vault**:
  - Full archive of historical receipts (including old vouchers migrated from Tally 9).
  - High-resolution, printable official PDF receipts featuring the institution letterhead, DOTE Code 331, authorized seal, and itemized ledger.
  - **Tamper-Proof QR Code**: Scan with any phone camera to verify authenticity via the public endpoint `/api/verify/:hash`.
- **Instant Online Payment**:
  - Supports UPI (GPay, PhonePe, Paytm), Debit Card, and Net Banking.
  - Generates verifiable receipt immediately upon payment confirmation.

### 3. Office Accounts / Cashier Counter Desk
- **Quick Counter POS (<15 Seconds)**:
  - Rapid search by student Reg No or Name.
  - Collect fee via Cash, Demand Draft (DD), Cheque, Bank Challan, or Counter QR UPI.
  - Automatically prints A4 or 80mm thermal counter receipt.
- **Legacy Tally XML Migration Engine**:
  - One-click tool to import legacy Tally ERP/Tally 9 XML exports (`data/sample_tally_export.xml`).
  - Seamlessly imports historical student ledger vouchers into the active database.
- **Daily Cash-Book & Defaulter Audit**:
  - Real-time breakdown of cash collections vs online collections.
  - Filterable defaulters list with one-click WhatsApp/SMS reminder triggers.

---

## 📂 Project Architecture

```
f:\sriramprojects\sptc\
├── package.json               # Project manifest & dependencies
├── server.js                  # Express backend & REST API engine
├── .gitignore                 # Git ignore file
├── README.md                  # System documentation
├── data\
│   ├── database.json          # Seed JSON database (Students, Fees, Receipts)
│   └── sample_tally_export.xml# Sample legacy Tally XML export for sync
└── public\
    ├── index.html             # Single-Page Application (Public + Student + Cashier)
    ├── assets\
    │   └── logo.svg           # Vector official emblem of SPTC Rayavaram
    ├── css\
    │   └── style.css          # Design system, academic theme, and print media rules
    └── js\
        ├── data-store.js      # Client API service
        ├── receipts.js        # Official receipt renderer & QR generator
        ├── fees.js            # Student fee dashboard & payment modal
        ├── cashier.js         # Counter POS & Tally migration engine
        └── app.js             # View switcher & modal interactions
```

---

## 🛡️ License & Copyright
© 2026 Subramanian Polytechnic College (SPTC), Rayavaram, Pudukkottai District. All Rights Reserved.
Affiliated to the Directorate of Technical Education (DOTE), Chennai.
