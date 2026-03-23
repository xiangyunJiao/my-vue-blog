-- 将旧默认站点标题同步为新默认（已在后台自定义的标题不受影响）
UPDATE site_settings SET value = '爱编程的小云' WHERE key = 'site_title' AND value = '小云的随笔集';
