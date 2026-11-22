import { useEffect, useState } from "react";
import { useDeleteAdminUser, usePaginatedProfiles, useUpdateAdminUser } from "@/hooks/use-admin-profiles";
import { Skeleton } from "@/components/ui/skeleton";
import { UserManagementTable } from "./UserManagementTable";

export function AdminUsersPage() {
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const pageSize = 25;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { data, isLoading, isFetching, isPlaceholderData } = usePaginatedProfiles({
    page,
    pageSize,
    searchQuery,
    roleFilter,
  });

  const profiles = data?.profiles || [];
  const totalPages = data?.totalPages || 1;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!isFetching && !isPlaceholderData && profiles.length === 0 && page > 1) {
      setPage((prev) => prev - 1);
    }
  }, [isFetching, isPlaceholderData, page, profiles.length]);

  // Toasts and cache invalidation are handled by the mutations.
  const handleToggleSubscriber = (id: string, current: boolean) =>
    updateUser.mutate({ id, updates: { plan: current ? null : "pro" } });

  const handleToggleRole = (id: string, currentRole: "user" | "admin") =>
    updateUser.mutate({ id, updates: { role: currentRole === "admin" ? "user" : "admin" } });

  const handleDeleteUser = (id: string) => deleteUser.mutate(id);

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <UserManagementTable
          searchQuery={searchInput}
          setSearchQuery={setSearchInput}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          profiles={profiles}
          onToggleRole={handleToggleRole}
          onToggleSubscriber={handleToggleSubscriber}
          onDelete={handleDeleteUser}
          page={page}
          totalPages={totalPages}
          isFetching={isFetching}
          isPlaceholderData={isPlaceholderData}
          onPageChange={setPage}
          onPreviousPage={() => setPage((prev) => Math.max(1, prev - 1))}
          onNextPage={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        />
      )}
    </div>
  );
}
