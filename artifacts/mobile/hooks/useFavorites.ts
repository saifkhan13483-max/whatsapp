import { useState, useEffect, useCallback } from "react";
import { getItem, setItem, StorageKeys } from "@/lib/storage";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useFavorites() {
  const [favorites, setFavorites] = useState<number[]>([]);
  const qc = useQueryClient();

  useEffect(() => {
    getItem<number[]>(StorageKeys.FAVORITES).then((stored) => {
      if (stored) setFavorites(stored);
    });
  }, []);

  const isFavorite = useCallback((id: number) => favorites.includes(id), [favorites]);

  const toggle = useCallback(
    async (id: number) => {
      const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
      setFavorites(next);
      await setItem(StorageKeys.FAVORITES, next);
      apiFetch(`/contacts/${id}/favorite`, { method: "POST" }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["contacts", "favorites"] });
    },
    [favorites, qc]
  );

  return { favorites, isFavorite, toggle };
}
