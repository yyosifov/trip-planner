import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { CreateTripInput, TravelerProfile, PlaceStatus } from "@trip/shared";

export interface Trip {
  id: string;
  name: string;
  destination: string;
  daysMin: number;
  daysMax: number;
  routeType: string;
  notes: string;
}
export interface ChatMsg { role: "user" | "assistant"; content: string; }
export interface Place {
  id: string;
  name: string;
  category: string;
  description: string;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
  kidSuitability: number;
  difficulty: string;
  weatherDependent: boolean;
  status: PlaceStatus;
  estDurationMin: number;
  tags: string[];
  sourceUrl: string | null;
}
export interface BoardItem { id: string; place: Place; timeSlot?: string; }
export interface BoardDay { id: string; dayIndex: number; baseCity: string; items: BoardItem[]; }

export const useTrips = () =>
  useQuery({ queryKey: ["trips"], queryFn: () => api.get<Trip[]>("/trips") });

export const useTrip = (id: string) =>
  useQuery({ queryKey: ["trip", id], queryFn: () => api.get<Trip>(`/trips/${id}`) });

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTripInput) => api.post<Trip>("/trips", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
  });
}

export const useProfile = (id: string) =>
  useQuery({ queryKey: ["profile", id], queryFn: () => api.get<TravelerProfile>(`/trips/${id}/profile`) });

export const useMessages = (id: string) =>
  useQuery({ queryKey: ["messages", id], queryFn: () => api.get<ChatMsg[]>(`/trips/${id}/intake/messages`) });

export function usePostIntake(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api.post<{ reply: string; profile: TravelerProfile }>(`/trips/${id}/intake/messages`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", id] });
      qc.invalidateQueries({ queryKey: ["messages", id] });
    },
  });
}

export function useClearMessages(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.del(`/trips/${id}/intake/messages`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", id] });
      qc.invalidateQueries({ queryKey: ["profile", id] });
    },
  });
}

export function useRunResearch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ created: number }>(`/trips/${id}/research`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["places", id] }),
  });
}

export const usePlaces = (id: string, status?: PlaceStatus) =>
  useQuery({
    queryKey: ["places", id, status ?? "all"],
    queryFn: () => api.get<Place[]>(`/trips/${id}/places${status ? `?status=${status}` : ""}`),
  });

export function useSetPlaceStatus(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { placeId: string; status: PlaceStatus }) =>
      api.patch<Place>(`/places/${v.placeId}`, { status: v.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["places", tripId] }),
  });
}

export const useBoard = (id: string) =>
  useQuery({ queryKey: ["board", id], queryFn: () => api.get<BoardDay[]>(`/trips/${id}/board`) });

export function useCreateDay(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { dayIndex: number; baseCity: string }) => api.post<BoardDay>(`/trips/${id}/days`, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board", id] }),
  });
}

export function useAddItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { dayId: string; placeId: string }) =>
      api.post(`/days/${v.dayId}/items`, { placeId: v.placeId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board", tripId] }),
  });
}

export function useSuggestBackups(tripId: string) {
  return useMutation({
    mutationFn: (dayId: string) =>
      api.post<Place[]>(`/trips/${tripId}/days/${dayId}/backups`),
  });
}
