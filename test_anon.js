const { createClient } = require("@supabase/supabase-js");

const url = "https://dphxaglpramhwcwcnpay.supabase.co";
const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaHhhZ2xwcmFtaHdjd2NucGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDg4NzksImV4cCI6MjA4ODgyNDg3OX0.Z2uLJlqYfs6RGcrRe3SpyaHo7BzvO4QgmYp9lXVEKN0";
const s = createClient(url, anon);

s.from("tracker_tasks").select("id, name").limit(5).then(res => {
  if (res.error) {
    console.error("Error with anon key:", res.error);
  } else {
    console.log("Success! Found:", res.data.length, "tasks");
    console.log(res.data);
  }
});
