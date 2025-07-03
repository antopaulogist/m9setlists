# Lists App - Netlify + Supabase Setup

This is a shared lists application that works perfectly with Netlify hosting and Supabase database.

## **Features**
- ✅ Create and manage multiple lists
- ✅ Share lists with family members
- ✅ Real-time sync across devices
- ✅ Persistent cloud storage
- ✅ Works on mobile and desktop
- ✅ Completely free hosting

## **Quick Deploy (5 minutes)**

### **Step 1: Set Up Supabase Database**

1. **Go to [supabase.com](https://supabase.com)**
2. **Sign up** with GitHub (free)
3. **Create new project**
   - Name: `lists-app`
   - Database password: (create a strong password)
   - Region: Choose closest to you
4. **Wait for setup** (takes 2-3 minutes)

### **Step 2: Create Database Table**

1. **In Supabase Dashboard**, go to **"SQL Editor"**
2. **Run this SQL** (copy and paste):

```sql
CREATE TABLE lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    items JSON NOT NULL,
    created BIGINT NOT NULL
);

-- Enable Row Level Security
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since no auth needed)
CREATE POLICY "Allow all operations" ON lists
    FOR ALL 
    USING (true)
    WITH CHECK (true);
```

3. **Click "Run"**

### **Step 3: Get Your Supabase Keys**

1. **Go to "Settings" → "API"**
2. **Copy these values:**
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

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
4. **Choose your GitHub repository**: `antopaulogist/lists`
5. **Deploy settings** (leave defaults):
   - Build command: (empty)
   - Publish directory: (empty)
6. **Click "Deploy"**

### **Step 6: You're Live!**

🎉 **Your app is now live!** Netlify will give you a URL like:
`https://amazing-app-name.netlify.app`

## **Sharing with Your Wife**

1. **Share the Netlify URL** with your wife
2. **She can bookmark it** on her phone/computer
3. **Lists sync automatically** between all devices
4. **Works from anywhere** with internet

## **Custom Domain (Optional)**

If you want to use your own domain:
1. **In Netlify Dashboard**, go to "Domain management"
2. **Add custom domain**: `lists.yourdomain.com`
3. **Follow DNS setup** instructions
4. **SSL certificate** is automatic

## **Updating Your App**

To make changes:
1. **Edit your code** locally
2. **Commit and push** to GitHub:
   ```bash
   git add .
   git commit -m "Update app"
   git push
   ```
3. **Netlify automatically redeploys** your changes

## **Data Backup**

Your lists are stored in Supabase:
- **Automatic backups** included
- **View/export data** in Supabase dashboard
- **Restore from backups** if needed

## **Troubleshooting**

### **Lists not loading**
- Check Supabase keys in `assets/script.js`
- Verify database table exists
- Check browser console for errors

### **Can't save lists**
- Verify Row Level Security policy is set
- Check Supabase API key permissions
- Ensure table structure is correct

### **Slow loading**
- Supabase has global CDN (should be fast)
- Check your internet connection
- Verify closest Supabase region was selected

## **Cost**

- **Netlify**: Free (unlimited personal projects)
- **Supabase**: Free (up to 50,000 database rows)
- **Your usage**: Well within free limits

## **What's Next?**

Your setup is production-ready! Optional enhancements:
- Add user authentication for private lists
- Set up email notifications
- Add list sharing via links
- Create mobile app version

## **Support**

- **Netlify Docs**: [docs.netlify.com](https://docs.netlify.com)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **GitHub Issues**: Report bugs in your repository 