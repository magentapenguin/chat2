// this file is used to create a supabase client instance
// and export it for use in other files
// because it was breaking things
import { createClient } from '@supabase/supabase-js';
import type * as Types from './supabase-types';

export const supabase = createClient('https://piukosdnirsgphzdyjan.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpdWtvc2RuaXJzZ3BoemR5amFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODc3MDIsImV4cCI6MjA2MjY2MzcwMn0.eIvvAayqroZzDpmlz21uRpllEAJhV_vrQtBJccxcvLw');
export type { Types };