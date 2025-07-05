# Mickey 9s Setlist App - Netlify + Supabase Setup

This is a band setlist management application for Mickey 9s with real-time synchronization and drag-and-drop song ordering.

## **Features**
- ✅ Create and manage multiple setlists
- ✅ Share setlists with band members
- ✅ **Real-time sync** - Changes appear instantly on all devices
- ✅ **Drag-and-drop reordering** - Easily rearrange songs in setlists
- ✅ Persistent cloud storage with automatic backups
- ✅ Works on mobile and desktop
- ✅ Completely free hosting
- ✅ Undo functionality for accidental deletions
- ✅ Setlists ordered oldest to newest

## **Quick Deploy (5 minutes)**

### **Step 1: Set Up Supabase Database**

1. **Go to [supabase.com](https://supabase.com)**
2. **Sign up** with GitHub (free)
3. **Create new project**
   - Name: `mickey9s-setlist`
   - Database password: (create a strong password)
   - Region: Choose closest to you
4. **Wait for setup** (takes 2-3 minutes)

### **Step 2: Create Database Table**

1. **In Supabase Dashboard**, go to **"SQL Editor"**
2. **Run this SQL** (copy and paste):

```sql
CREATE TABLE setlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    songs JSON NOT NULL,
    created BIGINT NOT NULL
);

-- Enable Row Level Security
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since no auth needed)
CREATE POLICY "Allow all operations" ON setlists
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Enable real-time for instant sync between devices
ALTER TABLE setlists REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE setlists;
```

3. **Click "Run"**

### **Step 3: Get Your Supabase Keys**

1. **Go to "Settings" → "API"**
2. **Copy these values:**
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

### **Step 4: Update Your Code**

1. **Open `assets/script.js`**
2. **Update lines 2-3** with your Supabase details:
```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### **Step 5: Deploy to Netlify**

1. **Go to [netlify.com](https://netlify.com)**
2. **Sign up** with GitHub (free)
3. **Click "Add new site" → "Import from Git"**
4. **Choose your GitHub repository**: `mickey9s-setlist`
5. **Deploy settings** (leave defaults):
   - Build command: (empty)
   - Publish directory: (empty)
6. **Click "Deploy"**

### **Step 6: You're Live!**

🎉 **Your Mickey 9s Setlist app is now live!** Netlify will give you a URL like:
`https://mickey9s-setlist.netlify.app`

## **Sharing with Your Band**

1. **Share the Netlify URL** with your band members
2. **They can bookmark it** on their phones/computers
3. **Setlists sync automatically** between all devices
4. **Works from anywhere** with internet

## **Using the App**

### **Creating Setlists**
- Click "Create a new setlist..." on the main page
- Name your setlist (e.g., "Spring 2024 Tour", "Acoustic Set")
- Setlists are ordered oldest to newest

### **Adding Songs**
- Click on any setlist to open it
- Add songs using the "Add a new song..." field
- Songs appear in the order you add them

### **Reordering Songs**
- **Drag and drop** songs to reorder them
- Click and hold the **⋮⋮** handle next to any song
- Drag to the desired position
- Changes sync instantly across all devices

### **Editing Setlist Names**
- Click on any setlist title to edit it
- Press Enter to save changes

### **Deleting Items**
- Use the red delete button on songs or setlists
- **Undo** appears for 5 seconds after deletion

## **Custom Domain (Optional)**

If you want to use your own domain:
1. **In Netlify Dashboard**, go to "Domain management"
2. **Add custom domain**: `setlist.mickey9s.com`
3. **Follow DNS setup** instructions
4. **SSL certificate** is automatic

## **Updating Your App**

To make changes:
1. **Edit your code** locally
2. **Commit and push** to GitHub:
   ```bash
   git add .
   git commit -m "Update setlist app"
   git push
   ```
3. **Netlify automatically redeploys** your changes

## **Data Backup**

Your setlists are stored in Supabase:
- **Automatic backups** included
- **View/export data** in Supabase dashboard
- **Restore from backups** if needed

## **Troubleshooting**

### **Setlists not loading**
- Check Supabase keys in `assets/script.js`
- Verify database table exists
- Check browser console for errors

### **Can't save setlists**
- Verify Row Level Security policy is set
- Check Supabase API key permissions
- Ensure table structure is correct

### **Drag and drop not working**
- Ensure you're dragging by the **⋮⋮** handle
- Check that JavaScript is enabled
- Try refreshing the page

### **Slow loading**
- Supabase has global CDN (should be fast)
- Check your internet connection
- Verify closest Supabase region was selected

## **Cost**

- **Netlify**: Free (unlimited personal projects)
- **Supabase**: Free (up to 50,000 database rows)
- **Your usage**: Well within free limits

## **Security Note**

Your Supabase credentials are visible in the public code, but this is intentional and safe:

- **Anon Key**: Designed specifically for public client-side use
- **Row Level Security**: Database access controlled by policies, not key secrecy
- **Limited Permissions**: Anon key can only perform operations you've explicitly allowed
- **No Sensitive Data**: Your setlist app doesn't store personal/financial information

This is the standard security model for client-side applications using Supabase.

## **Real-Time Sync Testing**

Your app has real-time synchronization! To test it:

1. **Open your Netlify URL** in two browser tabs (or different devices)
2. **Create a setlist** in one tab
3. **Watch it appear instantly** in the other tab (no refresh needed!)
4. **Add/reorder songs** in one tab and see them sync immediately
5. **Check the console** - you should see "Real-time sync enabled"

### **Real-Time Features**

- ✅ **Instant setlist creation/deletion** across all devices
- ✅ **Immediate song additions/removals** 
- ✅ **Live drag-and-drop reordering** syncs to all devices
- ✅ **Live setlist name changes**
- ✅ **Automatic view switching** if someone deletes the setlist you're viewing
- ✅ **No refresh required** - everything syncs instantly

## **Mobile Usage**

The app is fully mobile-responsive:
- **Touch-friendly** drag and drop
- **Optimized** for phone screens
- **Works offline** (with limitations)
- **Add to home screen** for app-like experience

## **Band Workflow Ideas**

- **Create different setlists** for different venues/events
- **Practice setlist** - songs you're working on
- **Acoustic setlist** - unplugged versions
- **Covers setlist** - non-original songs
- **Encore setlist** - crowd favorites

**Your Mickey 9s Setlist app is now ready for seamless band collaboration!** 🎸🎵

## **Support**

- **Netlify Docs**: [docs.netlify.com](https://docs.netlify.com)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **GitHub Issues**: Report bugs in your repository 