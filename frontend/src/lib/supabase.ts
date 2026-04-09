import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ymlgvisfbtafkujnzjcj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltbGd2aXNmYnRhZmt1am56amNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTUwMzgsImV4cCI6MjA5MDU3MTAzOH0.xb3ID81uvyl93AX-hfppD-wQrRJQPM6V8mMxlJGnwb8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
