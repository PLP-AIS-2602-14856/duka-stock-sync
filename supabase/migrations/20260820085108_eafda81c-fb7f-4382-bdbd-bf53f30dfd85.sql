ALTER TABLE public.items RENAME COLUMN discontinued TO is_discontinued;

ALTER TABLE public.sync_logs RENAME TO sync_log;
ALTER TABLE public.sync_log RENAME COLUMN ran_at TO run_at;
ALTER TABLE public.sync_log RENAME COLUMN message TO notes;