import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fwtggxslfborsyihpjnv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3dGdneHNsZmJvcnN5aWhwam52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MTEwMDMsImV4cCI6MjA4NDM4NzAwM30.u0SPi2tbtIpsdVpWuhf3Cec2XfTyk28eEtJehl7HzPU'

export const supabase = createClient(supabaseUrl, supabaseKey)