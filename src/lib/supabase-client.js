/* ═══════════════════════════════════════════
   VENSHA SKIN — Browser-side Supabase Client
   ═══════════════════════════════════════════ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://anvwpodhvhjpnlquktuo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFudndwb2RodmhqcG5scXVrdHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjcxOTQsImV4cCI6MjEwMDQwMzE5NH0.hh7NY1_hGtqwp0qOZQ-ewW5RdPmyYGOkLJHWc4PjHIE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
