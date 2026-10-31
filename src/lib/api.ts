import { supabase } from "./supabase";
import { createHttpRepository } from "./persistence/http-repository";
import { createSupabaseRepository } from "./persistence/supabase-repository";

// Choose the storage adapter once. Views depend only on this stable interface.
const repository = supabase
  ? createSupabaseRepository(supabase)
  : createHttpRepository();

export const { listCharacters, loadCharacter, saveCharacter, deleteCharacter } = repository;
