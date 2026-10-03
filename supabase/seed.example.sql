-- OPTIONAL DEVELOPMENT ONLY. These records are explicitly samples, not genuine boutique stock.
insert into public.categories(name,slug,description,active,display_order) values
 ('Sample — Sarees','sample-sarees','Development sample. Edit or delete before launch.',true,0),
 ('Sample — Kurtis','sample-kurtis','Development sample. Edit or delete before launch.',true,1)
on conflict(slug) do nothing;
insert into public.collections(name,slug,description,active,display_order) values
 ('Sample — Festive edit','sample-festive','Development sample. Edit or delete before launch.',true,0)
on conflict(slug) do nothing;
