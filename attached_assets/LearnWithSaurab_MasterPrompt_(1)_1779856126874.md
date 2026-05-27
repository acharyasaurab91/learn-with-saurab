# 🎓 MASTER BUILD PROMPT — "Learn With Saurab" Ed-Tech Platform
### Written by: Senior Full-Stack Developer (30+ years experience)
### Platform: Nepal's Premier Online Education Platform for CEE, Loksewa, License, SEE, NEB & More

---

## 🧠 PROJECT OVERVIEW

Build a **world-class, full-stack educational web platform** called **"Learn With Saurab"** — a Nepal-focused ed-tech site. The platform has **5 main exam categories**, each containing their own subjects, sub-topics, videos, PDFs, and tests. Categories are NOT hardcoded — the **admin can create, edit, reorder, and delete category cards** from the admin panel at any time.

### Default Exam Categories (seeded, but fully editable by admin):
- **CEE** — Common Entrance Examination (medical/paramedical entrance). Subjects include: Biology, Chemistry, Physics, English, and **MAT (Management Aptitude Test)**. MAT is a *subject inside CEE*, NOT a separate category.
- **Loksewa / लोकसेवा** — Nepal Public Service Commission exams. Subjects include: General Knowledge, Nepali, English, Current Affairs, and **IQ / Reasoning**. IQ is a *subject inside Loksewa*, NOT a separate category.
- **License Exam** — Medical/Paramedical license (NMCL, CMA, Lab, Pharmacy, etc.)
- **SEE** — Secondary Education Examination (Grade 10)
- **NEB** — National Examinations Board (Grade 11 & 12)

> ⚠️ **CRITICAL RULE:** MAT is a subject/topic card INSIDE CEE. IQ/Reasoning is a subject/topic card INSIDE Loksewa. They must NEVER appear as top-level separate categories. The admin panel allows creating sub-subject cards within any category.

The platform must be so visually stunning and functionally powerful that even Unacademy's founder would be shocked by its quality.

---

## 🎨 DESIGN THEME & VISUAL IDENTITY

### Color Palette
```
Primary:        #0D7377  (deep teal — matches logo background)
Primary Dark:   #0A5C60
Accent Gold:    #F5C518  (premium/paid indicator)
Accent Red:     #E63946  (CTA buttons, danger states)
Dark BG:        #0B1120  (deep navy-black)
Dark Card:      #111827
Dark Surface:   #1F2937
Border:         rgba(255,255,255,0.08)
Text Primary:   #F9FAFB
Text Secondary: #9CA3AF
Success:        #10B981
Warning:        #F59E0B
```

### Typography
- **Headings:** `Montserrat` (800 weight) — bold, academic authority
- **Body:** `Inter` (400–600) — clean, readable
- **Nepali text:** `Noto Sans Devanagari` — for लोकसेवा labels

### Visual Style
- Dark theme throughout (deep navy/teal)
- Glassmorphism cards with `backdrop-filter: blur(20px)` and `border: 1px solid rgba(255,255,255,0.1)`
- Gradient mesh backgrounds using teal + indigo
- Micro-animations on hover (translateY -4px, glow shadows)
- Animated hero with floating elements
- Smooth scroll behavior
- Skeleton loaders for all data-fetched sections
- Mobile-first fully responsive (breakpoints: 480px, 768px, 1024px, 1280px)

---

## 🏗️ TECH STACK

### Backend
- **Node.js + Express.js** — REST API server
- **MongoDB + Mongoose** — database
- **express-session + connect-mongo** — persistent session store
- **bcryptjs** — password hashing
- **nodemailer** — email (Gmail SMTP)
- **multer** — file uploads (images, videos, PDFs, PPTs)
- **express-rate-limit** — brute-force protection
- **compression** — gzip responses
- **dotenv** — env configuration
- **cors** — cross-origin handling
- **crypto** — secure token generation

### Frontend
- Pure **HTML5 + CSS3 + Vanilla JavaScript** (no frontend framework — server-rendered)
- Fonts: Google Fonts (Montserrat, Inter, Noto Sans Devanagari)
- Icons: Font Awesome 6
- Video Player: **Custom HTML5 player** (no download, no screenshot, speed control)

### File Storage
- Local filesystem for development (`/uploads/videos`, `/uploads/resources`, `/uploads/question-images`)
- Production: **Cloudinary** (images) + **AWS S3 or Bunny.net** (videos) with signed URLs

---

## 📁 PROJECT FILE STRUCTURE

```
learn-with-saurab/
├── server.js                      # Main Express server (SINGLE FILE for all routes)
├── .env                           # Environment variables
├── package.json
├── video-utils.js                 # FFmpeg watermark helpers
├── helpers/
│   └── emailHelpers.js            # Password reset & welcome emails
├── public/
│   ├── style.css                  # Main styles
│   ├── modern-style.css           # Component library
│   ├── auth-style.css             # Login/signup styles
│   ├── admin-style.css            # Admin panel styles
│   ├── responsive.css             # Breakpoint overrides
│   ├── content-protection.js      # Anti-screenshot, anti-devtools
│   └── mobile-nav.js              # Hamburger menu logic
└── uploads/
    ├── videos/
    ├── resources/
    └── question-images/
```

---

## 🗄️ DATABASE SCHEMAS

### 1. User Schema
```javascript
{
  username: String (unique, required),
  email: String (unique, required),
  mobile: String (required),
  firstName: String (required),
  lastName: String (required),
  password: String (bcrypt hashed),
  isAdmin: Boolean (default: false),
  enrolledCourses: [ObjectId → Course],
  progress: {
    totalMinutesWatched: Number,
    coursesCompleted: Number
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: Date
}
```

### 2. Course Schema
```javascript
{
  title: String,
  description: String,
  price: Number (0 = free),
  imagePath: String,
  imageUrl: String,
  category: String, // references Category.slug — e.g., 'cee-preparation', 'loksewa-preparation'
  // This is a slug string (not ObjectId ref) so courses still work even if a category card is deleted
  // MAT courses → category: 'cee-preparation' (subject: 'MAT')
  // IQ courses   → category: 'loksewa-preparation' (subject: 'IQ/Reasoning')
  subject: String, // sub-subject label e.g., 'MAT', 'Biology', 'IQ/Reasoning', 'GK'
  level: String,
  duration: Number (minutes),
  isFeatured: Boolean,
  modules: [{
    moduleTitle: String,
    moduleDescription: String,
    videos: [{
      videoTitle: String,
      videoUrl: String,
      duration: Number,
      isFree: Boolean
    }],
    resources: [{
      title: String,
      fileUrl: String,
      type: String (pdf/ppt/doc/zip),
      isFree: Boolean
    }],
    tests: [ObjectId → Test]
  }]
}
```

### 3. Test Schema
```javascript
{
  title: String,
  description: String,
  courseId: ObjectId → Course (optional — can be standalone),
  category: String,
  duration: Number (minutes),
  totalMarks: Number,
  passMarks: Number,
  negativeMarking: Boolean,
  negativeMarkValue: Number (default: 0.25),
  isFree: Boolean,
  isPublished: Boolean,
  questions: [{
    questionText: String,
    questionImage: String (optional),
    options: [{ text: String, isCorrect: Boolean }],
    explanation: String,
    marks: Number,
    difficulty: Enum ['Easy', 'Medium', 'Hard']
  }]
}
```

### 4. Transaction Schema
```javascript
{
  userId: ObjectId → User,
  courseId: ObjectId → Course,
  amount: Number,
  transactionId: String (unique),
  paymentMethod: String (eSewa/Khalti/manual),
  status: Enum ['pending', 'completed', 'failed'],
  createdAt: Date
}
```

### 5. TestAttempt Schema
```javascript
{
  userId: ObjectId → User,
  testId: ObjectId → Test,
  answers: [{ questionId: String, selectedOption: Number }],
  score: Number,
  totalMarks: Number,
  timeTaken: Number (seconds),
  completedAt: Date
}
```

---

## 📄 ALL PAGES TO BUILD

### PUBLIC PAGES (no login required)
1. **`/` — Homepage**
2. **`/browse-courses` — All Courses catalog**
3. **`/course-preview/:id` — Course detail page**
4. **`/free-tests` — Free practice tests listing**
5. **`/about` — About Saurab page**
6. **`/contact` — Contact form**
7. **`/login` — Login page**
8. **`/signup` — Registration page**
9. **`/forgot-password` — Password reset request**
10. **`/reset-password/:token` — Password reset form**

### STUDENT PAGES (login required)
11. **`/dashboard` — Student dashboard**
12. **`/my-courses` — Enrolled courses**
13. **`/course/:id/learn` — Course learning page with video player**
14. **`/take-test/:testId` — Live exam/test interface**
15. **`/test-result/:attemptId` — Test result with explanations**
16. **`/profile` — Edit profile**
17. **`/my-tests` — Test history**

### ADMIN PAGES (isAdmin required)
18. **`/admin` — Admin dashboard with stats**
19. **`/admin/courses` — List all courses**
20. **`/admin/course/new` — Add new course**
21. **`/admin/course/:id/edit` — Edit course**
22. **`/admin/course/:id/modules` — Manage modules**
23. **`/admin/course/:id/add-video` — Upload video to module**
24. **`/admin/course/:id/add-resource` — Upload PDF/PPT to module**
25. **`/admin/categories` — ⭐ Manage homepage category cards (add/edit/reorder/delete)**
26. **`/admin/tests` — List all tests**
27. **`/admin/test/new` — Create new test**
28. **`/admin/test/:id/edit` — Edit test & questions**
29. **`/admin/test/:id/questions` — Add/remove questions with images**
30. **`/admin/users` — List all users, view enrollments**
31. **`/admin/transactions` — Payment history**
32. **`/admin/analytics` — Student progress charts**

---

## 🏠 HOMEPAGE DESIGN (Critical — Must be Stunning)

### Section 1: Hero
- Full-screen hero with animated gradient background (teal to indigo mesh)
- Floating particle/star animation (CSS only, no heavy libs)
- **Logo image** centered top
- Headline: "Nepal's #1 Platform for CEE, Loksewa & Medical License Preparation"
- Subheadline: "Join 10,000+ students learning from expert instructor Saurab"
- Two CTA buttons: `[Start Learning Free]` `[Explore Courses]`
- Stats bar below CTA: "5,000+ Students | 50+ Courses | 500+ Practice Tests | 98% Success Rate"
- **YouTube Channel promotion video** embedded (autoplay muted loop, user can unmute)

### Section 2: Exam Category Cards (Dynamic — Admin Controlled)

> **IMPORTANT:** These cards are NOT hardcoded in HTML. They are stored in a `Category` collection in MongoDB and rendered dynamically. The admin can add, edit, reorder, show/hide, and delete these cards from the admin panel.

**Default 5 seeded cards displayed on homepage:**
```
🏥 CEE Preparation
   "Medical & Paramedical Entrance"
   Subjects: Biology, Chemistry, Physics, English, MAT
   [MAT shown as a subject chip/badge inside this card — NOT a separate card]

📋 Loksewa / लोकसेवा
   "Nepal Public Service Commission"
   Subjects: GK, Nepali, English, Current Affairs, IQ/Reasoning
   [IQ shown as a subject chip/badge inside this card — NOT a separate card]

📚 NEB Preparation
   "Grade 11 & 12 Board Exams"

🎓 SEE Preparation
   "Grade 10 Secondary Education"

🩺 License Exam
   "NMCL, CMA, Lab, Pharmacy & More"
```

Each card shows: icon, title, subtitle, subject chips (if any), course count, and `[Explore →]` button.

**Admin can create additional cards** (e.g., "CTEVT", "Banking Exam", "Army/Police") with custom icon, title, color, and subject list — all from the admin panel without touching code.

### Category Schema (new — for dynamic homepage cards):
```javascript
{
  name: String (e.g., "CEE Preparation"),
  slug: String (e.g., "cee-preparation"),
  icon: String (Font Awesome class, e.g., "fas fa-stethoscope"),
  color: String (hex, e.g., "#0D7377"),
  description: String,
  subjects: [String] (e.g., ["Biology", "Chemistry", "MAT"]),
  courseCount: Number (auto-computed),
  isVisible: Boolean (toggle show/hide on homepage),
  order: Number (drag-to-reorder in admin),
  createdAt: Date
}
```

### Section 3: Featured Courses (Dynamic from DB)
Horizontal scroll on mobile, 3-column grid on desktop.
Course card: thumbnail, category badge, title, price (NPR), free/paid badge, `[Enroll]` button.

### Section 4: Free Practice Tests (Dynamic)
Grid of latest free tests with: title, category, question count, duration, `[Start Free Test]`.

### Section 5: Why Learn With Saurab
4 feature boxes: Expert Instructor | Proven Results | Mobile Friendly | Affordable Price

### Section 6: Instructor Section
Professional card for Saurab with photo placeholder, bio, credentials, YouTube subscribers count.

### Section 7: Testimonials
3 student testimonial cards with name, exam cleared, quote.

### Section 8: YouTube Channel CTA
Banner section promoting YouTube channel with subscribe button.

### Footer
4 columns: Brand + tagline | Quick Links | Exam Categories | Contact + Social (Facebook, Instagram, YouTube, Tiktok)

---

## 🎓 STUDENT DASHBOARD

After login, the dashboard must show:
- **Welcome greeting** with student's name and avatar initials
- **Progress cards:** Courses Enrolled | Tests Taken | Avg Score | Minutes Watched
- **Continue Learning** section: Last accessed course with progress bar
- **My Enrolled Courses** grid with progress
- **Recent Test Results** table
- **Recommended Free Tests** 
- **Quick Links:** Browse Courses | Free Tests | My Profile

---

## 📹 VIDEO PLAYER (Critical Feature)

For enrolled paid courses, build a **custom secure video player**:
```html
Features:
✅ HTML5 <video> element — no third-party player
✅ Custom controls bar (play/pause, seek, volume, speed, fullscreen)
✅ Speed control: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x
✅ DISABLED: Right-click context menu
✅ DISABLED: Video download (no download attribute, no direct URL access)
✅ DISABLED: Screenshot via CSS (user-select: none on player)
✅ JavaScript: detect devtools open → pause + blur video
✅ Videos served via signed/streamed URL — never direct file path
✅ Watermark overlay: student's email/name floats randomly on screen
✅ Module sidebar: list of all videos in the course with checkmark for completed
✅ Notes section below video
✅ Resources section: downloadable PDFs/PPTs for that module
✅ Auto-save progress every 30 seconds to server
```

---

## 📝 EXAM / TEST ENGINE (Critical Feature)

### Student View (`/take-test/:testId`)
```
Layout:
- Top bar: Test title | Timer countdown | Questions answered (X/Total) | Submit button
- Left sidebar: Question navigator grid (colored: unanswered=gray, answered=green, marked=yellow)
- Main area: Question with optional image, 4 options as radio buttons
- Bottom: Previous | Mark for Review | Next buttons
- Optional: negative marking notice if enabled

On Submit:
- Confirm dialog showing: attempted, unanswered, marked for review
- Process and redirect to result page
```

### Result Page (`/test-result/:attemptId`)
```
- Score card: X/Total marks, Pass/Fail badge, Time taken, Rank (if available)
- Question-by-question review:
  - Green = correct answer
  - Red = wrong answer selected
  - Yellow = not attempted
  - Show explanation for each question
- Option to retake test
- Share result button
```

### Admin Test Builder (`/admin/test/:id/questions`)
```
- Add question form:
  - Question text (rich textarea)
  - Upload question image (optional)
  - 4 option inputs
  - Mark correct option (radio)
  - Explanation text
  - Difficulty level dropdown
  - Marks value
- Question list with edit/delete buttons
- Drag to reorder (optional)
- Toggle negative marking on/off for whole test
- Preview test button
- Publish/Unpublish toggle
```

---

## ⚙️ ADMIN PANEL (Must be Powerful & Easy to Use)

### Dashboard Stats Cards
- Total Students | Total Courses | Total Tests | Total Revenue
- Chart: New signups last 30 days (bar chart using Chart.js or pure CSS)
- Recent transactions table

### ⭐ Category Card Management (`/admin/categories`) — NEW CRITICAL FEATURE

This is the feature that makes the homepage fully dynamic. Admin controls all exam category cards without touching code.

```
Page layout:
- "Add New Category" button at top
- Drag-to-reorder list of existing category cards
- Each row shows: icon preview | name | subject chips | visible toggle | Edit | Delete

Add/Edit Category Form (modal or dedicated page):
  - Card Name (e.g., "CEE Preparation")
  - Slug (auto-generated, e.g., "cee-preparation")  
  - Icon (Font Awesome class picker or text input, e.g., "fas fa-stethoscope")
  - Card Color (color picker — used for icon background/glow)
  - Short Description (shown under title on card)
  - Subjects List (add/remove chips — e.g., "Biology", "Chemistry", "MAT")
    → These chips appear on the homepage card so students know what's covered
    → MAT chip appears on CEE card; IQ chip appears on Loksewa card
  - Visible on Homepage (toggle — hide without deleting)
  - Display Order (number — or use drag-to-reorder)
  - Save button

Rules:
  ✅ Any category card the admin creates will auto-appear on the homepage
  ✅ Admin can hide a card temporarily (e.g., "coming soon" prep)
  ✅ Admin can reorder cards (drag handles)
  ✅ Deleting a category does NOT delete courses — courses just show under "Others"
  ✅ Subject chips are purely display labels — not separate entities
  ❌ MAT must NEVER be its own top-level category card
  ❌ IQ/Reasoning must NEVER be its own top-level category card
```

### Course Management
```
/admin/courses — table with: Title | Category | Price | Students | Actions
/admin/course/new — form:
  - Title, Description, Price (0 = free), Category, Level
  - Upload thumbnail image OR paste image URL
  - Toggle: Featured course
  - Save → redirect to module builder

/admin/course/:id/modules — module management:
  - Add module button → modal with moduleTitle, moduleDescription
  - Each module expands to show:
    - Videos list (title, duration, free/paid toggle, delete)
    - Resources list (title, type, free/paid toggle, delete)
    - Add Video button → upload form (title, file, isFree toggle)
    - Add Resource button → upload form (title, file, isFree toggle)
  - Drag to reorder modules
  - Delete module button
```

### Video Upload Specifics
- Accept: `.mp4, .webm, .mov` only
- Max size: 2GB
- Show upload progress bar
- After upload: show video player preview
- Store in `/uploads/videos/` with timestamp filename
- **Production note:** Stream from S3/Bunny.net, never expose raw file path

### Resource Upload Specifics
- Accept: `.pdf, .pptx, .docx, .txt, .zip`
- Max size: 50MB
- Show file icon based on type
- isFree toggle: free resources can be downloaded without enrollment

---

## 🔐 AUTH SYSTEM

### Registration Form Fields
- First Name | Last Name (side by side)
- Username (unique, auto-check availability via AJAX)
- Email
- Mobile (Nepal format: +977 XXXXXXXXXX)
- Password + Confirm Password (strength indicator)
- Terms acceptance checkbox

### Login
- Username or Email + Password
- Remember me (30-day session)
- Forgot password link
- After login: redirect to intended page or `/dashboard`

### Password Reset Flow
1. User enters email on `/forgot-password`
2. Server generates crypto token, saves to user, sends email via nodemailer
3. Email contains link: `/reset-password/:token` (valid 1 hour)
4. User sets new password
5. Token cleared, redirect to login

### Security
- bcryptjs salt rounds: 12
- Rate limit: 5 login attempts per 15 minutes per IP
- Session: MongoDB-backed, 24-hour TTL, httpOnly + sameSite:strict cookie
- XSS: strip `<script>` tags from all inputs
- All admin routes double-checked: session userId + isAdmin flag in DB

---

## 📧 EMAIL TEMPLATES (nodemailer)

### 1. Welcome Email
- Subject: "Welcome to Learn with Saurab! 🎓"
- HTML: Logo, welcome message, link to dashboard, support email

### 2. Password Reset Email
- Subject: "Reset Your Password — Learn with Saurab"
- HTML: Logo, reset link button, 1-hour expiry warning, ignore if not you message

### 3. Enrollment Confirmation
- Subject: "Enrolled in [Course Name]! Start Learning Now 🚀"
- HTML: Course name, link to course, instructor message

### 4. Contact Form Notification
- Sends to admin email when student submits contact form

---

## 🛡️ CONTENT PROTECTION (`/public/content-protection.js`)

```javascript
// 1. Disable right-click
document.addEventListener('contextmenu', e => e.preventDefault());

// 2. Disable F12, Ctrl+Shift+I, Ctrl+U
document.addEventListener('keydown', e => {
  if (e.key === 'F12' || 
     (e.ctrlKey && e.shiftKey && e.key === 'I') ||
     (e.ctrlKey && e.key === 'u')) {
    e.preventDefault();
  }
});

// 3. Detect devtools open → blur protected content
const threshold = 160;
setInterval(() => {
  if (window.outerWidth - window.innerWidth > threshold || 
      window.outerHeight - window.innerHeight > threshold) {
    document.querySelectorAll('.protected-video').forEach(v => {
      v.pause();
      v.style.filter = 'blur(20px)';
    });
  }
}, 1000);

// 4. Disable text selection on video player
// (apply class .no-select via CSS: user-select: none)
```

---

## 💳 PAYMENT INTEGRATION (Nepal-specific)

### eSewa Integration
```
On "Enroll Now" click:
1. Create Transaction record (status: pending)
2. Redirect to eSewa payment gateway with:
   - amt: course price
   - txAmt: 0
   - psc: 0
   - pdc: 0
   - scd: merchant code
   - pid: transactionId
   - su: /payment-success?q=...
   - fu: /payment-failed
3. On success callback: verify via eSewa API → enroll user → update transaction status
```

### Khalti Integration (alternative)
- Similar flow via Khalti SDK

### Manual/Admin Enrollment
- Admin can manually enroll any student in any course from admin panel
- Useful for cash payments or special cases

---

## 📱 MOBILE NAVIGATION

```javascript
// /public/mobile-nav.js
// Hamburger menu: toggle class .nav-open on nav
// Close on outside click
// Close on nav link click
// Smooth slide-in animation from right
// Overlay backdrop
```

---

## 🔧 MIDDLEWARE ORDER IN SERVER.JS

Critical: middleware must be applied in this exact order:
1. `dotenv.config()`
2. `express.static()` for public files
3. `compression()`
4. `express.urlencoded()` + `express.json()` with limit 50mb
5. `cors()`
6. `session()` with MongoStore
7. Rate limiters (general, then strict auth)
8. XSS sanitizer
9. Request logger (dev only)
10. Routes
11. Error handler (last)

---

## ⚠️ CRITICAL ISSUES TO FIX FROM ORIGINAL CODE

1. **`dotenv.config()` called twice** — remove duplicate
2. **HTML injected inside route handlers** — extract to separate template functions or `.html` files
3. **Duplicate multer storage definitions** (`videoStorage`, `uploadVideo` — same thing defined twice)
4. **No CSRF protection** — add `csurf` middleware for all POST forms
5. **Session secret fallback** — `crypto.randomBytes()` as fallback means sessions break on restart; always require `SESSION_SECRET` in .env
6. **Static file serving called twice** — consolidate into single `express.static('public')` call
7. **HTML strings in routes** — move all HTML to a `views/` folder as template functions
8. **Missing indexes** — `createIndexes()` is called after routes are set up; move it before server starts
9. **No helmet.js** — add `helmet()` for HTTP security headers
10. **Video URL exposure** — never return actual `videoUrl` to non-enrolled users; always use signed URL or streaming proxy

---

## 🚀 DEPLOYMENT CHECKLIST

### Environment Variables (.env)
```
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=<64-char random string>
EMAIL_USER=learnwithsaurab@gmail.com
EMAIL_PASS=<app password>
EMAIL_HOST=smtp.gmail.com
ESEWA_MERCHANT_CODE=...
CLOUDINARY_URL=...
AWS_ACCESS_KEY=...
AWS_SECRET_KEY=...
S3_BUCKET_NAME=...
```

### Production Setup — RECOMMENDED STACK (Owner Decision)
- **Hosting:** Railway.app — free tier to start, one-click Node.js deploy, scales easily
- **Database:** MongoDB Atlas — free 512MB tier (enough for 2000+ students)
- **Domain:** `learnwithsaurab.com.np` from Mercantile Nepal (~NPR 800/year) — builds more trust with Nepali students
- **Images:** Cloudinary free tier
- **Videos:** Bunny.net CDN (~$1/month per 1TB) — most cost-effective for Nepal bandwidth
- **Payment:** eSewa FIRST (launch), Khalti SECOND (add after launch) — don't delay launch for both
- **SSL:** Auto-provided by Railway.app (no setup needed)
- **Process manager:** PM2 (Railway handles this automatically)

> 💡 **Growth Strategy (13K TikTok followers = your biggest asset):**
> 1. Post free CEE/Loksewa tips on TikTok → drive to website free content
> 2. Free tests on website capture email/phone → retarget for paid courses
> 3. First 3 months: focus on free content + building trust
> 4. Month 4+: launch paid courses, your audience is already warm
> 5. Never do monthly subscription early — Nepali students prefer one-time pay per course

---

## 🌐 SOCIAL MEDIA & CONTACT INTEGRATION

All the following must appear in the footer, contact page, and instructor section. Replace placeholder `#` links with actual URLs when building:

```
YouTube:   [Saurab's YouTube Channel URL]
Facebook:  [Learn With Saurab Facebook Page URL]
Instagram: [Instagram Page URL]
TikTok:    [TikTok Profile URL — 13K followers, primary growth channel]
Email:     [Saurab's contact email]
Phone:     [Saurab's contact number]
```

Footer must show all 4 social icons (YouTube, Facebook, Instagram, TikTok) with hover color animations. TikTok icon: use Font Awesome `fab fa-tiktok`.

---

## 💰 BUSINESS MODEL (Final Decision)

- **Free content:** Some videos, some PDFs, all free tests — no login required to browse
- **Paid per course:** Students pay once per course (NPR price set by admin) — lifetime access
- **No monthly subscription** at launch — add later when user base grows
- **Mixed courses:** Admin sets each video/resource as free or paid individually within a course
- **Payment gateway:** eSewa at launch → add Khalti in Phase 2
- **Manual enrollment:** Admin can enroll any student manually (for cash/bank transfer payments)

---

## 🎯 PRIORITY BUILD ORDER

Build in this sequence:

**Phase 1 — Core Foundation**
1. Database schemas + server setup (clean, no duplicates)
2. Auth system (login, signup, forgot password)
3. Homepage (stunning design)
4. Course listing + course preview pages

**Phase 2 — Learning Platform**
5. Student dashboard
6. Course learning page with video player
7. PDF/PPT resource viewer

**Phase 3 — Test Engine**
8. Test taking interface
9. Result page with explanations
10. Free tests listing

**Phase 4 — Admin Panel**
11. Course management (CRUD + module builder + uploads)
12. Test builder (questions + images + negative marking toggle)
13. User management
14. Analytics dashboard

**Phase 5 — Payments & Polish**
15. eSewa/Khalti integration
16. Email notifications
17. Content protection
18. Mobile optimization
19. Performance optimization (caching, image compression, lazy loading)

---

## 📊 SUCCESS METRICS

The final website must achieve:
- Google Lighthouse Score: 90+ (Performance, Accessibility, SEO)
- Mobile-first responsive: perfect on all screen sizes 320px–4K
- Page load time: < 2 seconds
- Video start time: < 1 second
- Admin can add a full course with videos and tests in under 10 minutes
- Students can find, enroll, and start a course in under 3 clicks

---

---

## 📋 OWNER'S FINAL DECISIONS SUMMARY

| Decision | Choice |
|---|---|
| Domain | learnwithsaurab.com.np (buy from Mercantile Nepal) |
| Hosting | Railway.app (free tier → paid when scaling) |
| Database | MongoDB Atlas (free tier) |
| Language | English + Nepali toggle |
| Payment (launch) | eSewa only |
| Payment (phase 2) | Add Khalti |
| Business model | Free content + per-course paid |
| Subscription | No — add later |
| Instructor photo | Upload later (placeholder for now) |
| Social channels | YouTube, Facebook, Instagram, TikTok (13K followers) |
| Target students (6mo) | 500–2000 website visitors, fewer premium |
| MAT | Subject inside CEE — NOT separate category |
| IQ/Reasoning | Subject inside Loksewa — NOT separate category |
| Category cards | Fully dynamic — admin creates/edits from panel |

---

*This is the complete, final, production-ready specification for Learn With Saurab. Every feature, every decision, every architectural choice has been confirmed by the owner. Any developer or AI can take this document and build the full platform exactly as envisioned. This will be the best ed-tech platform in Nepal.*
