-- Insert BR subscription plans
INSERT INTO subscription_plans (id, name, price, credits, currency, features, stripe_product_id) VALUES
('plan_free_br', 'Plano Gratuito', 0.00, 100, 'BRL', ARRAY['100 créditos por mês', 'Recursos básicos', 'Suporte da comunidade'], 'prod_SyYQmZkivJM5A7'),
('plan_basic_br', 'Plano Básico', 45.00, 1000, 'BRL', ARRAY['1000 créditos por mês', 'Acesso a todo conteúdo', 'Cancele a qualquer momento'], 'prod_SyYToyDtOUI77G'),
('plan_pro_br', 'Plano Pro', 75.00, 2000, 'BRL', ARRAY['2000 créditos por mês', 'Suporte prioritário', 'Conteúdo exclusivo', 'Cancele a qualquer momento'], 'prod_SyYWNbi47WMsVh'),
('plan_vip_br', 'Plano VIP', 125.00, 5000, 'BRL', ARRAY['5000 créditos por mês', 'Suporte prioritário', 'Conteúdo VIP exclusivo', 'Acesso antecipado a novos recursos', 'Cancele a qualquer momento'], 'prod_SyYYCUxunSxrty')
ON CONFLICT (id) DO NOTHING;