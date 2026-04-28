import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Search, UserCheck, UserX, Shield,
  GraduationCap, BookOpen, Plus, RefreshCw
} from 'lucide-react'
import clsx from 'clsx'
import { usersApi } from '@/lib/api'
import {
  AppLayout, TopHeader, StatCard, Spinner, EmptyState, ConfirmDialog
} from '@/components/ui'
import { type UserRole } from '@/types'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const ROLE_CONFIG: Record<UserRole, { label: string; icon: React.ReactNode; badge: string }> = {
  estudiante: { label: 'Estudiante', icon: <GraduationCap size={14} />, badge: 'badge-blue' },
  docente:    { label: 'Docente',    icon: <BookOpen size={14} />,      badge: 'badge-green' },
  admin:      { label: 'Admin',      icon: <Shield size={14} />,        badge: 'badge-purple' },
}

export default function AdminUsers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [page, setPage] = useState(1)
  const [deactivateId, setDeactivateId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users', { page, search, filterRole, filterActive }],
    queryFn: () => usersApi.list({
      page, limit: 20,
      ...(search ? { search } : {}),
      ...(filterRole ? { role: filterRole } : {}),
      ...(filterActive !== '' ? { is_active: filterActive === 'true' } : {}),
    }),
    staleTime: 30_000,
  })

  const { data: statsData } = useQuery({
    queryKey: ['user-stats'],
    queryFn: usersApi.stats,
    staleTime: 60_000,
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => usersApi.update(id, { is_active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['user-stats'] })
      setDeactivateId(null)
      toast.success('Usuario desactivado')
    },
  })

  const activateMut = useMutation({
    mutationFn: (id: string) => usersApi.update(id, { is_active: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuario activado')
    },
  })

  const users = data?.items ?? []

  return (
    <AppLayout>
      <TopHeader
        title="Gestión de Usuarios"
        subtitle={`${data?.total ?? 0} usuarios registrados`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users size={20} />} label="Total usuarios" value={statsData?.total ?? 0}
          iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard icon={<GraduationCap size={20} />} label="Estudiantes"
          value={statsData?.by_role?.estudiante ?? 0} iconBg="bg-primary-100" iconColor="text-primary-600" />
        <StatCard icon={<BookOpen size={20} />} label="Docentes"
          value={statsData?.by_role?.docente ?? 0} iconBg="bg-emerald-100" iconColor="text-emerald-600" />
        <StatCard icon={<Shield size={20} />} label="Admins"
          value={statsData?.by_role?.admin ?? 0} iconBg="bg-purple-100" iconColor="text-purple-600" />
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Buscar por nombre o correo..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select className="input w-auto" value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setPage(1) }}>
            <option value="">Todos los roles</option>
            <option value="estudiante">Estudiante</option>
            <option value="docente">Docente</option>
            <option value="admin">Admin</option>
          </select>
          <select className="input w-auto" value={filterActive} onChange={(e) => { setFilterActive(e.target.value); setPage(1) }}>
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
          {(search || filterRole || filterActive) && (
            <button onClick={() => { setSearch(''); setFilterRole(''); setFilterActive(''); setPage(1) }}
              className="btn-ghost text-slate-500 text-sm">
              <RefreshCw size={13} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : users.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Users size={40} />} title="No se encontraron usuarios" />
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Grado</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th>Registrado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => {
                const roleConf = ROLE_CONFIG[u.role as UserRole]
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {u.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-navy-900 text-sm">{u.full_name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={clsx('badge flex items-center gap-1 w-fit', roleConf.badge)}>
                        {roleConf.icon} {roleConf.label}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-slate-500">{u.grade ?? '—'}</span>
                    </td>
                    <td>
                      <span className={clsx('badge', u.is_active ? 'badge-green' : 'badge-red')}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-400">
                        {u.last_login
                          ? formatDistanceToNow(new Date(u.last_login), { addSuffix: true, locale: es })
                          : 'Nunca'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-400">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString('es-CO')
                          : '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        {u.is_active ? (
                          <button
                            onClick={() => setDeactivateId(u.id)}
                            className="btn-ghost p-1.5 rounded-lg text-red-400 hover:bg-red-50 text-xs flex items-center gap-1"
                            title="Desactivar"
                          >
                            <UserX size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => activateMut.mutate(u.id)}
                            disabled={activateMut.isPending}
                            className="btn-ghost p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50"
                            title="Activar"
                          >
                            <UserCheck size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {(data?.total ?? 0) > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                Mostrando {(page - 1) * 20 + 1}–{Math.min(page * 20, data?.total ?? 0)} de {data?.total ?? 0}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-1 px-3 text-xs">
                  ← Anterior
                </button>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= (data?.total ?? 0)} className="btn-secondary py-1 px-3 text-xs">
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deactivateId}
        onClose={() => setDeactivateId(null)}
        onConfirm={() => deactivateId && deactivateMut.mutate(deactivateId)}
        title="Desactivar usuario"
        message="El usuario no podrá iniciar sesión mientras esté desactivado. ¿Continuar?"
        loading={deactivateMut.isPending}
      />
    </AppLayout>
  )
}
