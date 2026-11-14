-- Organizations can be suspended by a platform admin (own migration: a new enum value
-- can't be used in the same transaction that adds it).
alter type public.org_status add value if not exists 'suspended';
