import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import { isOffline, OFFLINE_MESSAGE } from '@/shared/utils/apiErrors';

import { TransactionApi } from '../api/transactions.api';
import { newTransactionId, outboxEntryFor, useOutbox } from '../offline/outbox';
import type {
  CreateTransactionInput,
  Transaction,
  UpdateTransactionInput,
  TransactionListParams,
} from '../types';

export const TRANSACTION_KEYS = {
  all: ['transactions'] as const,
  list: (params?: TransactionListParams) =>
    [...TRANSACTION_KEYS.all, 'list', params] as const,
  detail: (id: string) => [...TRANSACTION_KEYS.all, 'detail', id] as const,
};

// Keys for related queries that depend on transaction data
export const RELATED_QUERY_KEYS = [
  ['budgets'],
  ['dashboard'],
  ['accounts'],
  ['reports'],
  // Deleting a bill's expense reopens that due date.
  ['bills'],
  ['utang'],
  ['paluwagan'],
] as const;

export function useTransactionCategories(type?: string) {
  return useQuery({
    queryKey: [...TRANSACTION_KEYS.all, 'categories', type],
    queryFn: () => TransactionApi.getCategories(type),
  });
}

export function useTransactionList(params?: TransactionListParams) {
  return useQuery({
    queryKey: TRANSACTION_KEYS.list(params),
    queryFn: () => TransactionApi.list(params),
  });
}

export function useInfiniteTransactionList(params?: Omit<TransactionListParams, 'page'>) {
  return useInfiniteQuery({
    queryKey: [...TRANSACTION_KEYS.all, 'infinite', params],
    queryFn: ({ pageParam }) => TransactionApi.list({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}

export function useTransactionDetail(id: string) {
  return useQuery({
    queryKey: TRANSACTION_KEYS.detail(id),
    queryFn: () => TransactionApi.getById(id),
    enabled: !!id,
    select: (data) => data.data,
  });
}

function refreshTransactions(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.all });
  RELATED_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
}

/** Whether the change reached the server, or was saved on the phone to send later. */
export interface SaveResult {
  queued: boolean;
}

// No reply at all (offline, timed out, or blocked before sending) means the
// change may not have arrived, so it is kept and sent later. A reply with an
// error, such as "Insufficient balance", is shown in the form instead.
function noReply(error: unknown) {
  return !(error as AxiosError)?.response;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransactionInput): Promise<SaveResult> => {
      // The phone picks the id, so sending it again never adds it twice.
      const payload = { ...input, id: newTransactionId() };
      if (isOffline()) {
        useOutbox.getState().add({ kind: 'create', payload });
        return { queued: true };
      }
      try {
        await TransactionApi.create(payload);
        return { queued: false };
      } catch (error) {
        if (!noReply(error)) throw error;
        useOutbox.getState().add({ kind: 'create', payload });
        return { queued: true };
      }
    },
    onSuccess: (result) => {
      if (!result.queued) refreshTransactions(queryClient);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    /** original: the transaction before the edit, needed to save it offline. */
    mutationFn: async ({ original, ...input }: UpdateTransactionInput & { original?: Transaction }): Promise<SaveResult> => {
      const queue = () => {
        if (!original) throw new Error(OFFLINE_MESSAGE);
        useOutbox.getState().add({ kind: 'update', payload: input, original });
        return { queued: true };
      };
      // Not sent yet: the edit joins the unsent change.
      if (outboxEntryFor(input.id) || isOffline()) return queue();
      try {
        await TransactionApi.update(input);
        return { queued: false };
      } catch (error) {
        if (!noReply(error)) throw error;
        return queue();
      }
    },
    onSuccess: (result) => {
      if (!result.queued) refreshTransactions(queryClient);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    /** Pass the whole transaction so it can also be deleted offline. */
    mutationFn: async (target: string | Transaction): Promise<SaveResult> => {
      const id = typeof target === 'string' ? target : target.id;
      const original = typeof target === 'string' ? undefined : target;
      const queue = () => {
        if (!original) throw new Error(OFFLINE_MESSAGE);
        useOutbox.getState().add({ kind: 'delete', transactionId: id, original });
        return { queued: true };
      };
      if (outboxEntryFor(id) || isOffline()) return queue();
      try {
        await TransactionApi.delete(id);
        return { queued: false };
      } catch (error) {
        if (!noReply(error)) throw error;
        return queue();
      }
    },
    onSuccess: (result) => {
      if (!result.queued) refreshTransactions(queryClient);
    },
  });
}

/** The unsent changes, as a list the screens can show on top of server data. */
export function useOutboxEntries() {
  return useOutbox((state) => state.entries);
}
