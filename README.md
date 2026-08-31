# منصة التطوع الصحي

نسخة عربية RTL جاهزة للربط مع Supabase.

## الملفات
- index.html
- styles.css
- app.js
- config.js

## تشغيلها
1. افتحي `config.js`.
2. ضعي Publishable key من Supabase مكان:
   `PASTE_YOUR_PUBLISHABLE_KEY_HERE`
3. ارفعي الملفات إلى أي استضافة صفحات ثابتة.

## مهم
- لا تضعي `service_role` أو أي Secret key داخل الموقع.
- قاعدة البيانات التي أنشأناها تحتاج أن يكون RLS مفعّلًا.
- حساب المشرفة يجب أن يكون له `role = 'admin'` في جدول `profiles`.

## ملاحظة
المنصة مصممة للتطوع فقط: حملات، تسجيل متطوعين، طلبات، حالات قبول، وتعويضات.
