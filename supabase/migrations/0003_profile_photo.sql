-- A face beside a recipe. Optional, and it lives in the same bucket as the
-- recipe photographs, under the author's own folder, so the upload rules
-- already written cover it.
alter table public.profiles add column if not exists photo_path text;
