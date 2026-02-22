# Farcaster Frame Mini App Template

A clean, secure template for building Farcaster Frame mini applications with Next.js, TypeScript, and Tailwind CSS. This template demonstrates how to access and display user data from the Farcaster Frame context without any external API dependencies.

## 🚀 Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd farcaster-frame-template
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open [http://localhost:3000](http://localhost:3000)** to see your app

4. **Test in Farcaster:** Share your deployed URL in a Farcaster cast to see the Frame in action

## 📁 Project Structure

```
├── app/
│   ├── components/
│   │   ├── ClientPage.tsx    # Client wrapper component (DO NOT MODIFY)
│   │   └── Demo.tsx          # Main frame component (CUSTOMIZE THIS)
│   ├── types/
│   │   └── frame.ts          # Frame SDK type definitions (DO NOT MODIFY)
│   ├── globals.css           # Global styles (MODIFY COLORS/FONTS)
│   ├── layout.tsx            # Root layout (CUSTOMIZE METADATA)
│   └── page.tsx              # Home page (DO NOT MODIFY)
├── public/
│   └── images/               # Add your images here (REQUIRED)
├── package.json              # Dependencies (CUSTOMIZE NAME/DESCRIPTION)
├── LICENSE                   # MIT License (UPDATE COPYRIGHT)
└── README.md                 # This file (CUSTOMIZE FOR YOUR PROJECT)
```

## 🎯 What This Template Shows

This template demonstrates a basic Farcaster Frame that:

- **Accesses Frame Context**: Shows how to get user data from Farcaster
- **Displays User Info**: Name, username, FID, location, profile picture
- **Generates User Stats**: Creates consistent stats based on user's FID
- **Handles Loading States**: Proper loading and error handling
- **Provides Debug Info**: Shows all available Frame context data
- **Implements Frame Actions**: Open URLs and share functionality

## 🔧 Comprehensive Customization Guide

### 1. **App Metadata & Branding** (REQUIRED TO CHANGE)

**File: `app/layout.tsx`**

**MUST CHANGE:**
```typescript
// Update these URLs to match your deployed app
const frameMetadata = {
  imageUrl: 'https://your-domain.com/images/frame-preview.png', // YOUR PREVIEW IMAGE
  button: {
    title: 'View Profile', // YOUR BUTTON TEXT
    action: {
      name: 'Your App Name', // YOUR APP NAME
      url: 'https://your-domain.com', // YOUR DEPLOYED URL
      splashImageUrl: 'https://your-domain.com/images/splash.png', // YOUR SPLASH IMAGE
      splashBackgroundColor: '#000000' // YOUR BRAND COLOR
    }
  }
};

export const metadata: Metadata = {
  title: 'Your App Name', // CHANGE TO YOUR APP NAME
  description: 'Your app description', // CHANGE TO YOUR DESCRIPTION
};
```

**WHY CHANGE:** These URLs are displayed in Farcaster when your Frame is shared. Wrong URLs will break your Frame.

**SECURITY NOTE:** Always use HTTPS URLs for production. HTTP will not work in Farcaster Frames.

### 2. **Main App Content** (CUSTOMIZE EXTENSIVELY)

**File: `app/components/Demo.tsx`**

#### **A) Update App Title and Branding**

**SHOULD CHANGE:**
```typescript
<h1 className="text-4xl md:text-5xl font-bold text-blue-600">
  Your App Name<br />Your Tagline
</h1>
<h2 className="text-2xl md:text-3xl font-bold text-blue-400">
  Your Subtitle
</h2>
```

**WHY CHANGE:** This is what users see first. Make it match your brand.

#### **B) Customize User Stats System**

**MODIFY THIS INTERFACE:**
```typescript
interface UserStats {
  level: number;        // Rename to your metric (e.g., points, rank, score)
  experience: number;   // Rename to your metric (e.g., progress, completion)
  reputation: number;   // Rename to your metric (e.g., rating, karma)
  activity: number;     // Rename to your metric (e.g., streak, participation)
}
```

**MODIFY THE STAT GENERATION:**
```typescript
function generateUserStats(fid?: number): UserStats {
  const seed = fid || 1234;
  const hash = (num: number) => Math.abs(Math.sin(num * 12.9898) * 43758.5453) % 1;
  
  return {
    level: Math.floor(hash(seed) * 50) + 1,      // CHANGE FORMULA FOR YOUR NEEDS
    experience: Math.floor(hash(seed * 2) * 100), // CHANGE FORMULA FOR YOUR NEEDS
    reputation: Math.floor(hash(seed * 3) * 100), // CHANGE FORMULA FOR YOUR NEEDS
    activity: Math.floor(hash(seed * 4) * 100),   // CHANGE FORMULA FOR YOUR NEEDS
  };
}
```

**WHY CHANGE:** The current system generates arbitrary stats. Replace with meaningful metrics for your app.

**EXAMPLES OF CUSTOM STATS:**
- **Gaming App**: Level, XP, Achievements, Wins
- **Social App**: Followers, Posts, Likes, Streak  
- **NFT App**: Collections, Rarity Score, Holdings, Trade Volume
- **DAO App**: Voting Power, Proposals, Governance Score, Contributions

#### **C) Update Stat Display Labels**

**CHANGE THESE LABELS:**
```typescript
<StatBar value={userStats.level} label="Level" />        // CHANGE "Level" 
<StatBar value={userStats.experience} label="Experience" /> // CHANGE "Experience"
<StatBar value={userStats.reputation} label="Reputation" /> // CHANGE "Reputation"
<StatBar value={userStats.activity} label="Activity" />     // CHANGE "Activity"
```

**WHY CHANGE:** Labels should match your app's terminology and purpose.

#### **D) Customize Welcome Message**

**REPLACE THIS TEXT:**
```typescript
<div className="text-gray-300 text-lg px-4 text-center">
  Welcome to this example Farcaster Frame! This template shows how to access and display user information from the Frame context.
  // REPLACE WITH YOUR MESSAGE
</div>
```

**WHY CHANGE:** This is your opportunity to explain your app's value proposition.

#### **E) Update Action Buttons**

**CUSTOMIZE BUTTON ACTIONS:**
```typescript
<button
  onClick={() => {
    if (window.frame?.sdk) {
      window.frame.sdk.actions.openUrl('https://warpcast.com'); // CHANGE URL
    }
  }}
  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-500 transition-colors"
>
  Open Warpcast  {/* CHANGE BUTTON TEXT */}
</button>
```

**COMMON BUTTON IDEAS:**
- Join Discord/Telegram
- Visit Website
- View Collection
- Join Waitlist
- Follow on Twitter
- Mint NFT
- Join DAO

**WHY CHANGE:** Buttons should drive users to your most important actions.

### 3. **Visual Styling** (OPTIONAL BUT RECOMMENDED)

#### **A) Color Scheme**

The template uses blue colors. To change to your brand colors:

**FIND AND REPLACE IN `Demo.tsx`:**
```typescript
// Current blue theme
text-blue-600 → text-your-color-600    (Main brand color)
text-blue-500 → text-your-color-500    (Secondary brand color)  
text-blue-400 → text-your-color-400    (Accent color)
bg-blue-600  → bg-your-color-600       (Button backgrounds)
border-blue-600 → border-your-color-600 (Borders)
```

**AVAILABLE TAILWIND COLORS:**
- `red` (red-600, red-500, etc.)
- `green` (green-600, green-500, etc.)
- `purple` (purple-600, purple-500, etc.)
- `yellow` (yellow-600, yellow-500, etc.)
- `pink` (pink-600, pink-500, etc.)
- `indigo` (indigo-600, indigo-500, etc.)
- `emerald` (emerald-600, emerald-500, etc.)
- `orange` (orange-600, orange-500, etc.)

#### **B) Background Styling**

**CHANGE BACKGROUND GRADIENT:**
```typescript
<div className="min-h-screen w-full bg-gradient-to-br from-gray-900 to-black">
// CHANGE TO: bg-gradient-to-br from-your-color-900 to-your-color-800
```

**WHY CHANGE:** Background should match your brand aesthetic.

#### **C) Font Customization**

**In `app/layout.tsx`:**
```typescript
// Current font
const rajdhani = Rajdhani({...});

// AVAILABLE GOOGLE FONTS:
// Inter, Roboto, Open_Sans, Montserrat, Poppins, etc.
```

**WHY CHANGE:** Font choice affects brand perception and readability.

### 4. **Required Image Assets** (MUST ADD)

**Add these files to `public/images/`:**

1. **`frame-preview.png`** (1200x630px)
   - Shows when Frame is shared in Farcaster
   - Should clearly represent your app
   - Include your app name/logo
   - Use high contrast for readability

2. **`splash.png`** (512x512px)  
   - Shows when Frame is launching
   - Should be your logo or app icon
   - Square format, simple design
   - Works on dark and light backgrounds

**WHY REQUIRED:** Farcaster Frames require these images to display properly.

**SECURITY NOTE:** Images must be publicly accessible over HTTPS.

### 5. **Package Configuration** (SHOULD CHANGE)

**File: `package.json`**

**UPDATE THESE FIELDS:**
```json
{
  "name": "your-app-name",                    // CHANGE: Use kebab-case
  "description": "Your app description",       // CHANGE: Describe your app
  "author": "Your Name <email@example.com>",  // CHANGE: Your info
  "keywords": ["your", "relevant", "keywords"], // CHANGE: For npm discovery
  "homepage": "https://your-app-url.com",     // ADD: Your website
  "repository": {                             // ADD: Your repo
    "type": "git",
    "url": "https://github.com/yourusername/your-repo"
  }
}
```

**WHY CHANGE:** Proper package.json helps with discoverability and attribution.

## 🛡️ Security Best Practices

### ✅ **What This Template Does Right**

1. **No Hardcoded Secrets**: Template contains zero API keys or sensitive data
2. **Client-Side Only**: All data generation happens in the browser
3. **Input Validation**: Frame context data is properly validated before use
4. **Error Boundaries**: Graceful error handling prevents crashes
5. **Type Safety**: Full TypeScript coverage prevents runtime errors
6. **HTTPS Ready**: Configured for secure deployment
7. **XSS Protection**: No dangerous innerHTML usage
8. **CSP Compatible**: No inline scripts or unsafe eval

### 🔒 **Security Controls by File**

#### **`app/layout.tsx` - Frame Metadata Security**

**SAFE TO MODIFY:**
- App title and description
- Button text and labels
- Color values (hex codes)

**SECURITY REQUIREMENTS:**
- All URLs MUST use HTTPS in production
- Image URLs MUST be publicly accessible
- No user input should be directly interpolated into metadata

**DANGEROUS - DO NOT DO:**
```typescript
// ❌ NEVER do this - XSS vulnerability
imageUrl: `https://example.com/user-${userInput}.png`

// ✅ Always use static, validated URLs
imageUrl: 'https://your-domain.com/images/frame-preview.png'
```

#### **`app/components/Demo.tsx` - User Data Security**

**SAFE TO MODIFY:**
- UI text and labels
- Color classes and styling
- Stat calculation formulas
- Button URLs (if static)

**SECURITY REQUIREMENTS:**
- Always validate Frame context data exists before using
- Never trust user-provided URLs without validation
- Sanitize any text that could contain HTML

**FRAME CONTEXT VALIDATION PATTERN:**
```typescript
// ✅ Always check data exists
{frameData?.user?.username && (
  <div>{frameData.user.username}</div>
)}

// ❌ Never assume data exists
<div>{frameData.user.username}</div> // Could crash if undefined
```

**URL VALIDATION FOR BUTTONS:**
```typescript
// ✅ Safe - static URL
window.frame.sdk.actions.openUrl('https://your-domain.com/join');

// ⚠️ Validate if dynamic
const safeUrl = validateUrl(userProvidedUrl);
if (safeUrl) {
  window.frame.sdk.actions.openUrl(safeUrl);
}

// ❌ NEVER - direct user input
window.frame.sdk.actions.openUrl(userInput); // XSS/Redirect vulnerability
```

### 🚨 **Common Security Mistakes to Avoid**

1. **Hardcoding API Keys**
   ```typescript
   // ❌ NEVER commit API keys
   const API_KEY = 'sk-1234567890abcdef';
   
   // ✅ Use environment variables
   const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
   ```

2. **Trusting User Input**
   ```typescript
   // ❌ Direct interpolation
   <div>Welcome {userData.name}</div>
   
   // ✅ Validation and sanitization
   <div>Welcome {sanitize(userData?.name) || 'User'}</div>
   ```

3. **Exposing Sensitive Data**
   ```typescript
   // ❌ Don't log sensitive data
   console.log('User data:', fullUserObject);
   
   // ✅ Log only what's needed
   console.log('User loaded:', userData?.username);
   ```

4. **Insecure External URLs**
   ```typescript
   // ❌ HTTP URLs won't work in Frames
   openUrl('http://example.com');
   
   // ✅ Always use HTTPS
   openUrl('https://example.com');
   ```

## 🔄 **What NOT to Modify** 

### **Critical Framework Files (DO NOT CHANGE)**

#### **`app/types/frame.ts`**
**DO NOT MODIFY** - Contains official Farcaster Frame SDK type definitions
- **Why:** These types match the actual Frame SDK API
- **Risk:** Changes could break Frame functionality
- **Exception:** Only add new interfaces for your custom data

#### **`app/components/ClientPage.tsx`**
**DO NOT MODIFY** - Handles server-side rendering compatibility
- **Why:** Required for Next.js SSR/CSR compatibility
- **Risk:** Changes could break the app in production
- **Exception:** Only modify if you understand Next.js SSR deeply

#### **`app/page.tsx`**
**DO NOT MODIFY** - Simple wrapper component
- **Why:** Provides clean separation between server and client components
- **Risk:** Minimal, but unnecessary complexity

#### **Frame SDK Integration Code**
**BE VERY CAREFUL** - Frame initialization and context handling
- **Located in:** `Demo.tsx` useEffect hooks
- **Why:** Complex async logic that handles Frame SDK lifecycle
- **Risk:** Changes could prevent Frame from working
- **Safe changes:** Error messages, retry counts, timeout values
- **Dangerous changes:** SDK method calls, context handling logic

### **Configuration Files (MODIFY WITH CAUTION)**

#### **`next.config.ts`**
**SAFE AS-IS** - Empty Next.js configuration
- **When to modify:** Adding custom webpack config, redirects, headers
- **Security note:** Review any added configuration for security implications

#### **`tailwind.config.ts`**  
**SAFE TO EXTEND** - Basic Tailwind configuration
- **Safe changes:** Adding custom colors, fonts, spacing
- **Keep:** Existing content paths (required for Tailwind to work)

#### **`tsconfig.json`**
**DO NOT MODIFY** - TypeScript configuration
- **Why:** Optimized for Next.js and Frame development
- **Risk:** Could break builds or type checking
- **Exception:** Adding paths for custom imports

### **Build Configuration (UNDERSTAND BEFORE CHANGING)**

#### **`eslint.config.mjs`**
**SAFE TO EXTEND** - Code quality rules
- **Safe changes:** Adding custom rules for your project
- **Keep:** Next.js and TypeScript extends

#### **`postcss.config.mjs`**
**DO NOT MODIFY** - Required for Tailwind CSS
- **Why:** Tailwind requires specific PostCSS configuration
- **Risk:** Could break all styling

## 🎨 Advanced Customization Examples

### **Example 1: NFT Profile App**

```typescript
interface NFTStats {
  collectionsOwned: number;
  totalNFTs: number;
  rarityScore: number;
  floorValue: number;
}

function generateNFTStats(fid: number): NFTStats {
  const seed = fid;
  const hash = (num: number) => Math.abs(Math.sin(num * 12.9898) * 43758.5453) % 1;
  
  return {
    collectionsOwned: Math.floor(hash(seed) * 20) + 1,
    totalNFTs: Math.floor(hash(seed * 2) * 500) + 10,
    rarityScore: Math.floor(hash(seed * 3) * 100),
    floorValue: Math.floor(hash(seed * 4) * 50) + 5,
  };
}
```

### **Example 2: Gaming Profile App**

```typescript
interface GameStats {
  level: number;
  xp: number;
  wins: number;
  winRate: number;
}

function generateGameStats(fid: number): GameStats {
  const seed = fid;
  const hash = (num: number) => Math.abs(Math.sin(num * 12.9898) * 43758.5453) % 1;
  
  const wins = Math.floor(hash(seed) * 1000);
  const totalGames = wins + Math.floor(hash(seed * 2) * 500);
  
  return {
    level: Math.floor(hash(seed * 3) * 100) + 1,
    xp: Math.floor(hash(seed * 4) * 100000),
    wins,
    winRate: Math.floor((wins / totalGames) * 100),
  };
}
```

### **Example 3: Social App Profile**

```typescript
interface SocialStats {
  followers: number;
  posts: number;
  engagement: number;
  streak: number;
}

function generateSocialStats(fid: number): SocialStats {
  const seed = fid;
  const hash = (num: number) => Math.abs(Math.sin(num * 12.9898) * 43758.5453) % 1;
  
  return {
    followers: Math.floor(hash(seed) * 10000),
    posts: Math.floor(hash(seed * 2) * 1000),
    engagement: Math.floor(hash(seed * 3) * 100),
    streak: Math.floor(hash(seed * 4) * 365),
  };
}
```

## 🔌 Adding External APIs Safely

If you need to integrate external APIs:

### **1. Environment Variables Setup**

```bash
# .env.local (never commit this file)
NEXT_PUBLIC_API_URL=https://api.example.com
API_SECRET_KEY=your_secret_key_here
```

### **2. API Route Pattern**

```typescript
// app/api/user-stats/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');
  
  // Validate input
  if (!fid || isNaN(Number(fid))) {
    return Response.json({ error: 'Invalid FID' }, { status: 400 });
  }
  
  try {
    // Use server-side API key (not exposed to client)
    const response = await fetch(`${process.env.API_URL}/stats/${fid}`, {
      headers: {
        'Authorization': `Bearer ${process.env.API_SECRET_KEY}`,
      },
    });
    
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
```

### **3. Client-Side API Usage**

```typescript
// In Demo.tsx
async function fetchUserStats(fid: number): Promise<UserStats | null> {
  try {
    const response = await fetch(`/api/user-stats?fid=${fid}`);
    if (!response.ok) throw new Error('Failed to fetch');
    return await response.json();
  } catch (error) {
    console.error('Stats fetch error:', error);
    return null;
  }
}
```

### **4. Rate Limiting**

```typescript
// Simple rate limiting example
const rateLimiter = new Map<string, number>();

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const lastRequest = rateLimiter.get(ip) || 0;
  
  if (now - lastRequest < 1000) { // 1 request per second
    return Response.json({ error: 'Rate limited' }, { status: 429 });
  }
  
  rateLimiter.set(ip, now);
  // ... rest of API logic
}
```

## 📱 Frame Testing & Validation

### **Local Testing**

1. **Frame Validator**: Use Farcaster's official Frame validator
2. **Local URLs**: Frames work with localhost for development
3. **Error Handling**: Check browser console for Frame SDK errors

### **Testing Checklist**

- [ ] Frame loads without errors
- [ ] User data displays correctly
- [ ] Buttons work and open correct URLs
- [ ] Images load properly
- [ ] Mobile responsive design
- [ ] Error states handle gracefully
- [ ] Loading states show properly

### **Common Issues**

1. **Frame not loading**: Check console for SDK errors
2. **Images not showing**: Verify HTTPS URLs and CORS headers
3. **Buttons not working**: Check Frame SDK initialization
4. **Metadata not updating**: Clear browser cache and re-share URL

## 🚀 Deployment & Production

### **Deployment Platforms**

#### **Vercel (Recommended)**
```bash
# Deploy automatically from GitHub
npm install -g vercel
vercel --prod
```

#### **Netlify**
```bash
# Build command: npm run build
# Publish directory: .next
```

#### **Railway**
```bash
# Dockerfile deployment supported
```

### **Production Checklist**

- [ ] All URLs updated to production domain
- [ ] HTTPS certificate valid
- [ ] Images uploaded and accessible
- [ ] Environment variables configured
- [ ] Error monitoring setup (Sentry, LogRocket, etc.)
- [ ] Analytics configured (if desired)
- [ ] Rate limiting implemented (if using APIs)
- [ ] CSP headers configured
- [ ] CORS headers configured for images

### **Post-Deployment**

1. **Test Frame in Farcaster**: Share your production URL
2. **Monitor Errors**: Check deployment logs for issues
3. **Performance**: Monitor load times and user experience
4. **Analytics**: Track Frame interactions and user engagement

## 🔍 Debugging Guide

### **Common Issues & Solutions**

#### **Frame SDK Not Loading**
```typescript
// Check if SDK is available
if (typeof window !== 'undefined' && window.frame?.sdk) {
  console.log('Frame SDK loaded successfully');
} else {
  console.error('Frame SDK not found');
}
```

#### **Context Data Missing**
```typescript
// Add detailed logging
useEffect(() => {
  async function debugFrameContext() {
    try {
      const context = await window.frame.sdk.context;
      console.log('Full context:', JSON.stringify(context, null, 2));
    } catch (error) {
      console.error('Context error:', error);
    }
  }
  debugFrameContext();
}, []);
```

#### **Images Not Loading**
- Verify HTTPS URLs
- Check CORS headers
- Test image URLs directly in browser
- Ensure proper image dimensions

#### **Buttons Not Working**
```typescript
// Add debugging to button clicks
onClick={() => {
  console.log('Button clicked');
  if (window.frame?.sdk) {
    console.log('SDK available, opening URL');
    window.frame.sdk.actions.openUrl(url);
  } else {
    console.error('SDK not available');
  }
}}
```

### **Development Tools**

1. **React DevTools**: Debug component state
2. **Browser Console**: Monitor Frame SDK interactions
3. **Network Tab**: Check image loading and API calls
4. **Lighthouse**: Performance and accessibility testing

## 📚 Learning Resources

### **Farcaster Frame Documentation**
- [Official Frame Docs](https://docs.farcaster.xyz/developers/frames)
- [Frame SDK Reference](https://github.com/farcasterxyz/miniapps)
- [Frame Validator](https://farcaster.xyz/~/developers)

### **Next.js Resources**
- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)
- [Deployment Guide](https://nextjs.org/docs/deployment)

### **TypeScript Resources**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React TypeScript Guide](https://react-typescript-cheatsheet.netlify.app/)

### **Security Resources**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/security)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Ensure all security best practices are followed
5. Update documentation if needed
6. Submit a pull request

### **Contribution Guidelines**

- No hardcoded secrets or API keys
- All code must be TypeScript with proper types
- Follow existing code style and formatting
- Add comments for complex logic
- Update README if adding new features
- Test on multiple devices and browsers

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

Feel free to use this template for commercial projects, just replace the copyright notice with your own information.

## 🆘 Support & Community

### **Getting Help**

1. **Check Issues**: Search existing GitHub issues first
2. **Create Issue**: Provide detailed description with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and device information
   - Error messages or console logs
   - Code snippets if relevant

### **Community**

- **Farcaster Discord**: Join for Frame development discussions
- **GitHub Discussions**: Ask questions and share your projects
- **Twitter/X**: Share your Frame creations with #FarcasterFrames

---

**🎉 Ready to build amazing Farcaster Frames? This template gives you everything you need to get started safely and securely!**

Remember: Security first, user experience second, cool features third. Build responsibly! 🛡️