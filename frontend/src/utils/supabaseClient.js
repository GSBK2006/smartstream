import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmhbqtbohyrhiyhthpmv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaGJxdGJvaHlyaGl5aHRocG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzQwNTMsImV4cCI6MjA5NjE1MDA1M30.73NwxImAzCNk5JFbhNntMBxh3dpubi_1TDyHxIfJYjY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function registerUser(username, password) {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername || !password) {
    return { success: false, message: "Username and password cannot be empty." };
  }
  
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('username')
      .eq('username', cleanUsername);
      
    if (existing && existing.length > 0) {
      return { success: false, message: "Username already exists." };
    }
    
    const hashedPassword = await hashPassword(password);
    const { error } = await supabase
      .from('users')
      .insert({ username: cleanUsername, password_hash: hashedPassword });
      
    if (error) throw error;
    return { success: true, message: "User registered successfully." };
  } catch (err) {
    return { success: false, message: `Registration error: ${err.message}` };
  }
}

export async function verifyUser(username, password) {
  const cleanUsername = username.trim().toLowerCase();
  try {
    const { data, error } = await supabase
      .from('users')
      .select('username, password_hash')
      .eq('username', cleanUsername);
      
    if (error) throw error;
    if (data && data.length > 0) {
      const user = data[0];
      const hashedPassword = await hashPassword(password);
      if (user.password_hash === hashedPassword) {
        return { success: true, user: { username: user.username } };
      } else {
        return { success: false, message: "Incorrect password." };
      }
    } else {
      return { success: false, message: "Username not found." };
    }
  } catch (err) {
    return { success: false, message: `Login error: ${err.message}` };
  }
}

export async function saveStagedData(username, target, rawData, rawStats, cleanedData = null, report = null) {
  try {
    const payload = {
      username,
      target,
      raw_data: rawData ? JSON.stringify(rawData) : null,
      raw_stats: rawStats ? JSON.stringify(rawStats) : null,
      cleaned_data: cleanedData ? JSON.stringify(cleanedData) : null,
      report: report ? JSON.stringify(report) : null,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('staged_data')
      .upsert(payload, { onConflict: 'username,target' });
      
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Error saving staged data:", err);
    return { success: false, message: err.message };
  }
}

export async function getStagedData(username, target) {
  try {
    const { data, error } = await supabase
      .from('staged_data')
      .select('*')
      .eq('username', username)
      .eq('target', target);
      
    if (error) throw error;
    if (data && data.length > 0) {
      const row = data[0];
      return {
        username: row.username,
        target: row.target,
        raw_data: row.raw_data ? JSON.parse(row.raw_data) : null,
        raw_stats: row.raw_stats ? JSON.parse(row.raw_stats) : null,
        cleaned_data: row.cleaned_data ? JSON.parse(row.cleaned_data) : null,
        report: row.report ? JSON.parse(row.report) : null
      };
    }
    return null;
  } catch (err) {
    console.error("Error getting staged data:", err);
    return null;
  }
}

export async function clearStagedData(username) {
  try {
    const { error } = await supabase
      .from('staged_data')
      .delete()
      .eq('username', username);
      
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Error clearing staged data:", err);
    return { success: false, message: err.message };
  }
}
