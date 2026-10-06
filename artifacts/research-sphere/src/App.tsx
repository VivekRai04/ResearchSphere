import { type ReactNode, useMemo, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@workspace/auth-web';
import { Command } from 'cmdk';
import { toast } from 'sonner';
import {
  useAddBookmark, useCreateAdminUser, useCreateCategory, useCreateDepartment, useDeleteCategory,
  useDeleteDepartment, useGetAdminAnalytics, useGetMyProfile, useGetPaper,
  useListAdminUsers, useListCategories, useListDepartments, useListMyBookmarks,
  useListMySubmissions, useListPapers, useListReviewQueue, usePreviewPaperMetadata,
  useRemoveBookmark, useRequestUploadUrl, useReviewPaper, useSubmitPaper,
  useSubmitPaperRevision, useUpdateCategory, useUpdateDepartment, useUpdateUserRole, useGetMyAnalytics, useAddPaperComment,
  useListMyCollections, useCreateCollection, useDeleteCollection, useAddPaperToCollection, useRemovePaperFromCollection,
  useGetAuthorProfile, useUpdateProfile, getGetAuthorProfileQueryKey,
  getGetAdminAnalyticsQueryKey, getGetPaperQueryKey, getGetMyProfileQueryKey,
  getListAdminUsersQueryKey, getListCategoriesQueryKey, getListDepartmentsQueryKey,
  getListMyBookmarksQueryKey, getListMySubmissionsQueryKey, getListPapersQueryKey,
  getListReviewQueueQueryKey, getGetMyAnalyticsQueryKey, getListMyCollectionsQueryKey,
} from '@workspace/api-client-react';
import type { AdminUser, Category, Department, Paper, PaperInput, UserRole, Collection } from '@workspace/api-client-react';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown,
  CircleHelp, Clipboard, FileText, Filter, FlaskConical, GraduationCap,
  LayoutDashboard, Library, LogOut, Menu, Search, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, Upload, Users, X, BookOpen, Plus, Pencil,
  Trash2, Clock3, Copy, SearchX, LoaderCircle, CheckCircle2, Eye, BarChart3,
  MessageSquare, Send, FolderPlus, Folder, PlusCircle, CheckSquare, Square, Brain, Link2, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';
import AuthPage from '@/pages/auth-page';

const queryClient = new QueryClient();
type IconType = typeof BookOpen;
const navItems: { href: string; label: string; icon: IconType; roles?: UserRole[]; requiresAuth?: boolean }[] = [
  { href: '/', label: 'Discover', icon: Search },
  { href: '/library', label: 'My library', icon: Library, requiresAuth: true },
  { href: '/submit', label: 'Submit research', icon: Upload, requiresAuth: true },
  { href: '/submissions', label: 'My submissions', icon: FileText, requiresAuth: true },
  { href: '/review', label: 'Review queue', icon: ShieldCheck, roles: ['REVIEWER', 'ADMIN'] },
  { href: '/admin', label: 'Administration', icon: Settings2, roles: ['ADMIN'] },
];

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
}

function Router() {
  const [location] = useLocation();
  if (location === '/auth') {
    return <ErrorBoundary resetKey={location}><AuthPage /></ErrorBoundary>;
  }
  return <ErrorBoundary resetKey={location}><Shell><Switch>
    <Route path="/" component={Discover} />
    <Route path="/papers/:paperId" component={PaperPage} />
    <Route path="/submit" component={SubmitPage} />
    <Route path="/library" component={LibraryPage} />
    <Route path="/submissions" component={SubmissionsPage} />
    <Route path="/authors/:userId" component={AuthorPage} />
    <Route path="/review" component={ReviewPage} />
    <Route path="/admin" component={AdminPage} />
    <Route component={NotFound} />
  </Switch></Shell></ErrorBoundary>;
}

function Shell({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const { data: profile, isLoading: profileLoading } = useGetMyProfile({ query: { enabled: isAuthenticated, queryKey: getGetMyProfileQueryKey(), retry: false } });
  const { data: departments } = useListDepartments({ query: { enabled: isAuthenticated, queryKey: getListDepartmentsQueryKey() } });
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [path] = useLocation();
  const displayName = profile?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Researcher';
  const role = profile?.role;
  return <div className="min-h-[100dvh] bg-background text-foreground">
    <CommandMenu />
    {editingProfile && <ProfileEditor profile={profile} user={user} departments={Array.isArray(departments) ? departments : []} onClose={() => setEditingProfile(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 md:flex ${sidebarCollapsed ? 'w-[72px]' : 'w-[254px]'}`}>
      <div className={`flex h-[82px] items-center border-b border-sidebar-border ${sidebarCollapsed ? 'justify-center px-0' : 'px-7 gap-3'}`}>
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><FlaskConical size={19} /></span>
          {!sidebarCollapsed && <span><strong className="font-editorial text-[21px] font-semibold leading-none tracking-tight">ResearchSphere</strong><small className="mt-1 block font-data text-[9px] uppercase tracking-[.2em] text-sidebar-foreground/60">Scholarly commons</small></span>}
        </Link>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`${sidebarCollapsed ? 'absolute -right-3 top-8 rounded-full border border-sidebar-border bg-sidebar p-1 shadow-sm' : 'ml-auto rounded p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}>
          {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
      {!sidebarCollapsed && <div className="px-5 pt-7 pb-3 font-data text-[9px] uppercase tracking-[.19em] text-sidebar-foreground/45">Workspace</div>}
      <div className={sidebarCollapsed ? "pt-7" : ""}></div>
      <nav className="space-y-1 px-3">
        {navItems.filter(item => (!item.requiresAuth || isAuthenticated) && (!item.roles || item.roles.includes(role ?? 'STUDENT'))).map(item => {
          const active = path === item.href || (item.href !== '/' && path.startsWith(item.href));
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className={`group flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-3'} rounded-lg py-[11px] text-[13px] no-underline transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} title={sidebarCollapsed ? item.label : undefined}>
            <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />{!sidebarCollapsed && <span className="flex-1">{item.label}</span>}{!sidebarCollapsed && item.href === '/review' && <span className="size-1.5 rounded-full bg-sidebar-primary" />}
          </Link>;
        })}
      </nav>
      <div className={`mt-auto border-t border-sidebar-border ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
        <div className={`flex items-center rounded-lg bg-sidebar-accent/65 ${sidebarCollapsed ? 'flex-col gap-2 p-2' : 'gap-3 p-3'}`}>
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d7c5a5] text-[12px] font-semibold text-[#243c43]" title={displayName}>{displayName.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()}</div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium">{isLoading || profileLoading ? 'Loading profile' : displayName}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-sidebar-foreground/55">
                <span>{role ? role.toLowerCase() : isAuthenticated ? 'Researcher' : 'Guest'}{profile?.departmentName ? ` · ${profile.departmentName}` : ''}</span>
                {isAuthenticated && <button onClick={() => setEditingProfile(true)} className="rounded hover:text-sidebar-foreground hover:underline">Edit</button>}
              </div>
            </div>
          )}
          {isAuthenticated ? <button aria-label="Log out" title="Log out" onClick={() => logout()} className={`rounded text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-white ${sidebarCollapsed ? 'p-2' : 'p-1.5'}`}><LogOut size={15} /></button> : <button onClick={() => login()} className="rounded-md bg-sidebar-primary px-2.5 py-1.5 text-[11px] font-semibold text-sidebar-primary-foreground" title={sidebarCollapsed ? "Log in" : undefined}>{sidebarCollapsed ? <LogOut size={15}/> : "Log in"}</button>}
        </div>
      </div>
    </aside>
    <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
      <Link href="/" className="flex items-center gap-2.5 no-underline"><span className="grid size-8 place-items-center rounded-lg bg-sidebar text-[#e7cc97]"><FlaskConical size={17} /></span><span className="font-editorial text-lg font-semibold">ResearchSphere</span></Link>
      <button onClick={() => setMenuOpen(v => !v)} className="rounded-lg p-2 hover:bg-muted" aria-label="Toggle navigation"><Menu size={20} /></button>
      {menuOpen && <div className="absolute left-0 right-0 top-[61px] border-b border-border bg-background p-3 shadow-lg">{navItems.filter(item => (!item.requiresAuth || isAuthenticated) && (!item.roles || item.roles.includes(role ?? 'STUDENT'))).map(({ href, label, icon: Icon }) => <Link onClick={() => setMenuOpen(false)} href={href} key={href} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm no-underline hover:bg-muted"><Icon size={17} />{label}</Link>)}<button onClick={() => isAuthenticated ? logout() : login()} className="w-full px-3 py-3 text-left text-sm">{isAuthenticated ? 'Log out' : 'Log in'}</button></div>}
    </header>
    <div className={`transition-all duration-300 ${sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-[254px]'}`}><div className="mx-auto max-w-[1440px] px-5 pb-16 pt-7 sm:px-8 lg:px-12 lg:pt-10">{children}</div></div>
  </div>;
}

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-end">
    <div><div className="mb-2 font-data text-[10px] uppercase tracking-[.2em] text-primary">{eyebrow}</div><h1 className="font-editorial text-[36px] font-medium leading-[1.07] tracking-[-.025em] sm:text-[43px]">{title}</h1>{subtitle && <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">{subtitle}</p>}</div>{action}
  </div>;
}

function Button({ children, onClick, kind = 'primary', disabled = false, type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'quiet' | 'outline' | 'danger'; disabled?: boolean; type?: 'button' | 'submit'; className?: string }) {
  const styles = { primary: 'bg-primary text-primary-foreground hover:brightness-95', quiet: 'text-foreground hover:bg-muted', outline: 'border border-border bg-card text-foreground hover:bg-muted', danger: 'bg-destructive text-destructive-foreground hover:brightness-95' };
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[kind]} ${className}`}>{children}</button>;
}

function State({ loading, error, retry, empty, children }: { loading?: boolean; error?: boolean; retry?: () => void; empty?: ReactNode; children?: ReactNode }) {
  if (loading) return <div className="space-y-3 py-3" aria-label="Loading"><div className="h-6 w-1/3 animate-pulse rounded bg-muted" /><div className="h-4 w-4/5 animate-pulse rounded bg-muted" /><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /></div>;
  if (error) return <div className="rounded-lg border border-border bg-card px-6 py-12 text-center"><CircleHelp className="mx-auto mb-3 text-accent-foreground" size={22} /><p className="font-editorial text-xl">We couldn't load this section.</p><p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p><Button className="mt-4" kind="outline" onClick={retry}>Try again</Button></div>;
  if (empty && (children === null || children === undefined || children === false)) return <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-14 text-center"><BookOpen size={23} className="mx-auto mb-3 text-primary" /><div className="font-editorial text-xl">{empty}</div></div>;
  return <>{children}</>;
}

function PaperRow({ paper, compact = false, onBookmark, bookmarked = false }: { paper: Paper; compact?: boolean; onBookmark?: () => void; bookmarked?: boolean }) {
  return <article data-testid={`card-paper-${paper.id}`} className="group border-b border-border py-5 first:border-t">
    <div className="flex items-start gap-4">
      <span className="mt-1 hidden size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground sm:flex"><FileText size={18} strokeWidth={1.6} /></span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-data text-[9px] uppercase tracking-[.12em] text-muted-foreground"><span>{paper.departmentName || 'Research'}</span><span className="text-border">/</span><span>{paper.researchArea}</span><span className="ml-1 rounded-sm bg-secondary/75 px-1.5 py-0.5 text-[8px] text-secondary-foreground">{paper.paperType}</span></div>
        <Link href={`/papers/${paper.id}`} className="font-editorial text-[21px] leading-[1.2] text-foreground no-underline transition-colors hover:text-primary sm:text-[24px]">{paper.title}</Link>
        {!compact && <p className="mt-2 line-clamp-2 max-w-4xl text-[12px] leading-[1.7] text-muted-foreground">{paper.abstract}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground"><Link href={`/authors/${paper.uploadedById}`} className="font-medium text-foreground/75 no-underline hover:text-primary">{paper.authorName}</Link><span>·</span><span>{paper.year}</span>{paper.doi && <><span>·</span><span className="font-data">DOI {paper.doi}</span></>}</div>
        {paper.keywords?.length > 0 && !compact && <div className="mt-3 flex flex-wrap gap-1.5">{paper.keywords.slice(0, 4).map(tag => <span key={tag} className="rounded-full border border-border px-2 py-1 text-[9px] text-muted-foreground">{tag}</span>)}</div>}
      </div>
      {onBookmark && <button onClick={onBookmark} aria-label={bookmarked ? 'Remove bookmark' : 'Save paper'} className={`rounded-md p-2 transition-colors hover:bg-muted ${bookmarked ? 'text-primary' : 'text-muted-foreground'}`}><Bookmark size={17} fill={bookmarked ? 'currentColor' : 'none'} /></button>}
    </div>
  </article>;
}

function Discover() {
  const [term, setTerm] = useState(''); const [search, setSearch] = useState(''); const [semantic, setSemantic] = useState(false);
  const [department, setDepartment] = useState(''); const [year, setYear] = useState(''); const [area, setArea] = useState(''); const [type, setType] = useState('');
  const params = useMemo(() => ({ q: search || undefined, semantic: semantic || undefined, departmentId: department || undefined, year: year ? Number(year) : undefined, researchArea: area || undefined, paperType: type || undefined }), [search, semantic, department, year, area, type]);
  const { data: papers, isLoading, isError, refetch } = useListPapers(params);
  const { data: departments } = useListDepartments(); const { data: categories } = useListCategories();
  const { isAuthenticated, login } = useAuth(); const { data: saved } = useListMyBookmarks({ query: { enabled: isAuthenticated, queryKey: getListMyBookmarksQueryKey(), retry: false } });
  const add = useAddBookmark(); const remove = useRemoveBookmark(); const qc = useQueryClient();
  const toggle = (id: string, yes: boolean) => { const mut = yes ? remove : add; mut.mutate({ paperId: id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListMyBookmarksQueryKey() }) }); };
  return <main className="page-enter">
    <div className="mb-8 grid gap-8 lg:grid-cols-[1fr_250px] lg:items-end">
      <div><div className="mb-3 flex items-center gap-2 font-data text-[10px] uppercase tracking-[.2em] text-primary"><span className="h-px w-7 bg-primary" /> The university research archive</div><h1 className="max-w-[800px] font-editorial text-[43px] leading-[1.02] tracking-[-.035em] sm:text-[58px]">Ideas travel further<br className="hidden sm:block" /> when research is <em className="text-primary">shared.</em></h1><p className="mt-4 max-w-xl text-[13px] leading-6 text-muted-foreground">Explore peer-reviewed work from across our academic community. Find the thread that connects your next question.</p></div>
      <div className="flex items-center gap-3 border-l border-border pl-5"><span className="font-editorial text-[34px] leading-none text-primary">{papers?.length ?? '—'}</span><span className="max-w-24 text-[10px] leading-4 text-muted-foreground">approved papers in this view</span></div>
    </div>
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
      <form onSubmit={e => { e.preventDefault(); setSearch(term.trim()); }} className="flex gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-input bg-background px-3"><Search size={17} className="shrink-0 text-muted-foreground" /><input aria-label="Search papers" data-testid="input-search-papers" value={term} onChange={e => setTerm(e.target.value)} className="h-12 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" placeholder="Search titles, authors, keywords, or research questions" /><kbd className="hidden rounded border border-border px-1.5 py-1 font-data text-[9px] text-muted-foreground sm:block">⌘ K</kbd></label>
        <Button type="submit" className="px-5"><span className="hidden sm:inline">Search archive</span><Search size={16} className="sm:hidden" /></Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setSemantic(!semantic)} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] transition ${semantic ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}><Sparkles size={13} />{semantic ? 'Semantic search on' : 'Search by meaning'}<span className={`relative h-3.5 w-6 rounded-full ${semantic ? 'bg-primary' : 'bg-border'}`}><span className={`absolute top-[2px] size-2.5 rounded-full bg-white transition-all ${semantic ? 'left-[11px]' : 'left-[2px]'}`} /></span></button>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="mr-1 font-data uppercase tracking-wider">Try</span>{['climate adaptation', 'neural interfaces', 'public health'].map((s, i) => <button key={s} onClick={() => { setTerm(s); setSearch(s); }} className="rounded-full px-2 py-1 hover:bg-muted hover:text-foreground">{s}{i < 2 ? ' ·' : ''}</button>)}</div>
      </div>
      <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <FilterSelect value={department} onChange={setDepartment} label="Department" options={(Array.isArray(departments) ? departments : []).map((d: Department) => [d.id, d.name])} />
        <FilterSelect value={year} onChange={setYear} label="Publication year" options={[...new Set((Array.isArray(papers) ? papers : []).map((p: Paper) => String(p.year)))].sort((a, b) => Number(b) - Number(a)).map(y => [y, y])} />
        <FilterSelect value={area} onChange={setArea} label="Research area" options={(Array.isArray(categories) ? categories : []).filter((c: Category) => c.kind === 'RESEARCH_AREA').map(c => [c.name, c.name])} />
        <FilterSelect value={type} onChange={setType} label="Paper type" options={(Array.isArray(categories) ? categories : []).filter((c: Category) => c.kind === 'PAPER_TYPE').map(c => [c.name, c.name])} />
        <button onClick={() => { setDepartment(''); setYear(''); setArea(''); setType(''); setSearch(''); setTerm(''); setSemantic(false); }} className="flex items-center justify-center gap-1.5 px-2 text-[10px] text-muted-foreground hover:text-foreground"><X size={13} />Clear</button>
      </div>
    </div>
    <div className="mt-8 flex items-center justify-between"><h2 className="font-data text-[10px] uppercase tracking-[.18em] text-muted-foreground">{search ? 'Search results' : 'Recently added research'}</h2><span className="text-[10px] text-muted-foreground">{papers?.length || 0} papers</span></div>
    <State loading={isLoading} error={isError} retry={() => refetch()} empty="No papers found. Try another search or broaden your filters.">
      {(Array.isArray(papers) ? papers : []).length === 0 ? null : <div className="mt-3">{(Array.isArray(papers) ? papers : []).map(p => <PaperRow key={p.id} paper={p} onBookmark={() => isAuthenticated ? toggle(p.id, !!saved?.some(b => b.id === p.id)) : login()} bookmarked={!!saved?.some(b => b.id === p.id)} />)}</div>}
    </State>
    {!isLoading && !isError && (Array.isArray(papers) ? papers : []).length === 0 && <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center"><SearchX size={24} className="mx-auto mb-3 text-primary" /><div className="font-editorial text-xl">No papers found</div><p className="mt-1 text-xs text-muted-foreground">Try another search or broaden your filters.</p></div>}
  </main>;
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return <label className="relative"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"><option value="">{label}</option>{options.map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" /></label>;
}

function PaperPage() {
  const { paperId = '' } = useParams(); const { data: detail, isLoading, isError, refetch } = useGetPaper(paperId, { query: { queryKey: getGetPaperQueryKey(paperId) } });
  const { isAuthenticated, login } = useAuth(); 
  const { data: saved } = useListMyBookmarks({ query: { enabled: isAuthenticated, queryKey: getListMyBookmarksQueryKey(), retry: false } });
  const { data: profile } = useGetMyProfile({ query: { enabled: isAuthenticated, queryKey: getGetMyProfileQueryKey(), retry: false } });
  const add = useAddBookmark(); const remove = useRemoveBookmark(); const qc = useQueryClient();
  const addComment = useAddPaperComment();
  const [copied, setCopied] = useState('');
  const [newComment, setNewComment] = useState('');
  const paper = detail?.paper; const bookmarked = !!saved?.some(p => p.id === paperId);
  const toggle = () => { if (!isAuthenticated) { login(); return; } (bookmarked ? remove : add).mutate({ paperId }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListMyBookmarksQueryKey() }) }); };
  const cite = (style: 'APA' | 'IEEE' | 'BibTeX') => {
    if (!paper) return;
    const apa = `${paper.authorName}. (${paper.year}). ${paper.title}. ${paper.departmentName}.${paper.doi ? ` https://doi.org/${paper.doi}` : ''}`;
    const content = style === 'APA' ? apa : style === 'IEEE' ? `${paper.authorName}, “${paper.title},” ${paper.departmentName}, ${paper.year}.${paper.doi ? ` doi: ${paper.doi}.` : ''}` : `@article{${paper.id.replace(/[^a-z0-9]/gi, '')},\n  title={${paper.title}},\n  author={${paper.authorName}},\n  year={${paper.year}},\n  journal={${paper.departmentName}},\n  doi={${paper.doi || ''}}\n}`;
    void navigator.clipboard?.writeText(content).then(() => { setCopied(style); window.setTimeout(() => setCopied(''), 1800); }).catch(() => toast.error('Clipboard access is unavailable in this browser.'));
  };

  const deleteComment = (commentId: string) => {
    fetch(`/api/admin/papers/${paperId}/comments/${commentId}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) qc.invalidateQueries({ queryKey: getGetPaperQueryKey(paperId) });
        else toast.error('Failed to delete comment.');
      });
  };

  const [showRemoveForm, setShowRemoveForm] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);

  const confirmRemovePaper = () => {
    if (!removeReason.trim()) return;
    setIsRemoving(true);
    fetch(`/api/admin/papers/${paperId}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: removeReason })
    }).then(res => {
      setIsRemoving(false);
      if (res.ok) {
        window.location.href = '/';
      } else {
        toast.error('Failed to remove paper.');
      }
    });
  };

  const downloadCard = async () => {
    try {
      const el = document.getElementById('share-card');
      if (!el) return;
      
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { 
        scale: 2, 
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: true
      });
      
      const link = document.createElement('a');
      link.download = `ResearchSphere-${paper?.title.slice(0, 20)}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (e: any) {
      console.error(e);
      toast.error('Error creating card: ' + e.message);
    }
  };

  return <main className="page-enter">
    <Link href="/" className="mb-7 inline-flex items-center gap-2 text-[11px] text-muted-foreground no-underline hover:text-primary"><ArrowLeft size={14} />Back to discovery</Link>
    {isLoading ? <State loading /> : isError || !paper ? <State error retry={() => refetch()} /> : <>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_275px]">
        <article>
          <div className="mb-3 flex flex-wrap items-center gap-2 font-data text-[9px] uppercase tracking-[.17em] text-muted-foreground"><span className="text-primary">{paper.departmentName}</span><span>/</span><span>{paper.researchArea}</span><span className="rounded bg-secondary px-2 py-1 text-secondary-foreground">{paper.paperType}</span></div>
          <h1 className="max-w-4xl font-editorial text-[36px] font-medium leading-[1.09] tracking-[-.025em] sm:text-[49px]">{paper.title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-border py-4 text-[11px]"><Link href={`/authors/${paper.uploadedById}`} className="font-semibold text-foreground no-underline hover:text-primary">{paper.authorName}</Link><span className="text-muted-foreground">· {paper.year}</span><span className="text-muted-foreground">· Version {paper.versionNumber}</span><span className="text-muted-foreground">· Cited by {paper.citedByCount || 0}</span>{paper.readingTime && <span className="text-muted-foreground">· ⏱️ {paper.readingTime} min read</span>}{paper.complexity && <span className="text-muted-foreground">· 🧠 {paper.complexity}</span>}<span className="ml-auto flex items-center gap-1 text-[9px] font-data uppercase tracking-wider text-primary">{paper.status === 'REJECTED' ? <><X size={13} />Removed</> : <><CheckCircle2 size={13} />Approved</>}</span></div>
          <section className="py-8"><h2 className="mb-4 font-data text-[10px] uppercase tracking-[.17em] text-primary">Abstract</h2><p className="max-w-3xl font-editorial text-[20px] leading-[1.65] text-foreground/90">{paper.abstract}</p></section>
          {paper.keywords?.length > 0 && <section className="border-t border-border py-6"><h2 className="mb-3 font-data text-[9px] uppercase tracking-[.17em] text-muted-foreground">Keywords</h2><div className="flex flex-wrap gap-2">{paper.keywords.map(k => <span key={k} className="rounded-full bg-secondary px-3 py-1.5 text-[10px] text-secondary-foreground">{k}</span>)}</div></section>}
          <section className="border-t border-border py-6"><h2 className="mb-3 font-data text-[9px] uppercase tracking-[.17em] text-muted-foreground">Publication details</h2><dl className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 text-[11px]"><div><dt className="text-muted-foreground">Department</dt><dd className="mt-1 font-medium">{paper.departmentName}</dd></div><div><dt className="text-muted-foreground">Year</dt><dd className="mt-1 font-medium">{paper.year}</dd></div><div><dt className="text-muted-foreground">Research area</dt><dd className="mt-1 font-medium">{paper.researchArea}</dd></div><div><dt className="text-muted-foreground">DOI</dt><dd className="mt-1 font-data">{paper.doi || 'Not assigned'}</dd></div></dl></section>
          <section className="border-t border-border py-6"><h2 className="mb-3 font-data text-[9px] uppercase tracking-[.17em] text-muted-foreground">Cite this paper</h2><div className="flex flex-wrap gap-2">{(['APA', 'IEEE', 'BibTeX'] as const).map(s => <Button key={s} kind="outline" onClick={() => cite(s)}>{copied === s ? <Check size={13} /> : <Copy size={13} />} {copied === s ? 'Copied' : s}</Button>)}</div></section>
          <section className="border-t border-border py-6">
            <h2 className="mb-4 font-data text-[9px] uppercase tracking-[.17em] text-muted-foreground">Academic Discussion</h2>
            <div className="space-y-6">
              {paper.comments && paper.comments.length > 0 ? (
                paper.comments.map(c => (
                  <div key={c.id} className="group flex gap-4">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground font-editorial font-medium">{c.userName.charAt(0).toUpperCase()}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold">{c.userName}</span>
                        <span className="text-[9px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                        {profile?.role === 'ADMIN' && (
                          <button onClick={() => deleteComment(c.id)} className="ml-auto hidden text-destructive hover:underline group-hover:inline-flex text-[10px] items-center gap-1" title="Delete Comment">
                            <Trash2 size={10} /> Delete
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-foreground/90">{c.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-muted-foreground">No comments yet. Start the discussion!</p>
              )}
              {isAuthenticated ? (
                <form className="mt-6 flex items-start gap-4 rounded-xl border border-border bg-card p-4" onSubmit={(e) => { e.preventDefault(); if (newComment.trim()) { addComment.mutate({ paperId, data: { content: newComment } }, { onSuccess: () => { setNewComment(''); qc.invalidateQueries({ queryKey: getGetPaperQueryKey(paperId) }); } }); } }}>
                  <div className="flex-1"><textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Ask a question or discuss findings..." className="w-full resize-none bg-transparent text-[11px] outline-none placeholder:text-muted-foreground" rows={2} /></div>
                  <Button type="submit" disabled={!newComment.trim() || addComment.isPending}><Send size={14} className="mr-1" /> Post</Button>
                </form>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                  <MessageSquare size={20} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">Log in to participate in the discussion.</p>
                  <Button kind="outline" className="mt-3" onClick={login}>Log in to comment</Button>
                </div>
              )}
            </div>
          </section>
        </article>
        <aside className="space-y-5">
          <div className="rounded-lg border border-border bg-card p-5"><h3 className="font-editorial text-xl">Read & save</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Keep this work close as your research develops.</p><Button className="mt-4 w-full" kind={bookmarked ? 'outline' : 'primary'} onClick={toggle}><Bookmark size={15} fill={bookmarked ? 'currentColor' : 'none'} />{bookmarked ? 'Saved to library' : 'Save to library'}</Button>
            {isAuthenticated && bookmarked && <PaperCollectionsManager paperId={paper.id} />}
            {paper.objectPath && <a href={`/api/storage/objects/${paper.objectPath}`} target="_blank" rel="noreferrer" className="mt-2 flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-4 text-[11px] font-semibold text-foreground no-underline hover:bg-muted"><ArrowDownToLine size={14} />Open full paper</a>}
            <Button className="mt-2 w-full" kind="outline" onClick={downloadCard}><Sparkles size={14} /> Share as Card</Button>
            {profile?.role === 'ADMIN' && paper.status !== 'REJECTED' && (
              showRemoveForm ? (
                <div className="mt-4 rounded-md border border-red-500/20 bg-red-500/5 p-3">
                  <div className="mb-2 text-[11px] font-semibold text-red-600">Remove Paper</div>
                  <textarea value={removeReason} onChange={e => setRemoveReason(e.target.value)} placeholder="Reason for removal..." className="w-full resize-none rounded border border-input bg-background p-2 text-[10px]" rows={3} autoFocus />
                  <div className="mt-2 flex gap-2">
                    <Button className="flex-1 bg-red-600 text-white hover:bg-red-700 border-none" kind="outline" disabled={isRemoving || !removeReason.trim()} onClick={confirmRemovePaper}>{isRemoving ? 'Removing...' : 'Confirm'}</Button>
                    <Button className="flex-1" kind="quiet" onClick={() => setShowRemoveForm(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button className="mt-2 w-full bg-red-600 text-white hover:bg-red-700 border-none" kind="outline" onClick={() => setShowRemoveForm(true)}><Trash2 size={14} /> Remove Paper</Button>
              )
            )}
          </div>
          {paper.versions && paper.versions.length > 1 && (
            <div className="rounded-lg border border-border bg-card p-5"><h3 className="font-editorial text-xl">Version history</h3>
              <div className="mt-3 space-y-2">{paper.versions.map((v: any) => (
                <div key={v.versionNumber} className="flex items-center justify-between border-t border-border py-2 first:border-t-0">
                  <span className="text-[11px] font-medium text-foreground">Version {v.versionNumber} {v.versionNumber === paper.versionNumber && <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">Current</span>}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] text-muted-foreground">{new Date(v.createdAt).toLocaleDateString()}</span>
                    {v.objectPath && <a href={`/api/storage/objects/${v.objectPath}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-primary hover:underline" aria-label={`Download version ${v.versionNumber}`}><ArrowDownToLine size={12} /> PDF</a>}
                  </div>
                </div>
              ))}</div></div>
          )}
          <div className="rounded-lg border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-editorial text-xl">Related research</h3><span className="font-data text-[9px] text-muted-foreground">{detail.related?.length || 0}</span></div>{detail.related?.length ? detail.related.map(r => <div key={r.id} className="border-t border-border py-3 first:border-t-0"><Link href={`/papers/${r.id}`} className="font-editorial text-[16px] leading-tight no-underline hover:text-primary">{r.title}</Link><div className="mt-1.5 text-[9px] text-muted-foreground">{r.authorName} · {r.year}</div></div>) : <p className="text-[11px] text-muted-foreground">No related papers available yet.</p>}</div>
        </aside>
      </div>
      <div id="share-card" className="absolute left-[-9999px] top-[-9999px] w-[1000px] h-[525px] overflow-hidden rounded-none" style={{ backgroundColor: '#ffffff', color: '#09090b', border: '1px solid #e4e4e7' }}>
        <div className="absolute top-[-25%] right-[-10%] pointer-events-none" style={{ opacity: 0.03, color: '#09090b' }}><FlaskConical size={600} /></div>
        <div className="relative w-full h-full p-12 flex flex-col justify-between">
          <div>
            <div className="mb-8 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-xl shadow-sm" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}><FlaskConical size={24} /></span>
                <div>
                  <strong className="block font-editorial text-[24px] font-semibold leading-none tracking-tight" style={{ color: '#0f172a' }}>ResearchSphere</strong>
                  <small className="block font-data text-[12px] uppercase tracking-[.2em] mt-1" style={{ color: '#71717a' }}>Scholarly commons</small>
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-data text-[11px] uppercase tracking-wider" style={{ borderColor: 'rgba(0,0,0,0.1)', backgroundColor: 'rgba(0,0,0,0.02)', color: '#52525b' }}>
                  <Clock3 size={12} /> {paper.readingTime || '10'} min read
                </div>
                <div className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-data text-[11px] uppercase tracking-wider" style={{ borderColor: 'rgba(0,0,0,0.1)', backgroundColor: 'rgba(0,0,0,0.02)', color: '#52525b' }}>
                  <Brain size={12} /> {paper.complexity || 'Advanced'}
                </div>
              </div>
            </div>
            
            <div className="mb-4 flex flex-wrap items-center gap-3 font-data text-[13px] uppercase tracking-[.15em] font-semibold" style={{ color: '#71717a' }}>
              <span style={{ color: '#0f172a' }}>{paper.departmentName}</span>
              <span style={{ opacity: 0.4 }}>/</span>
              <span>{paper.researchArea}</span>
            </div>
            
            <h1 className="mb-6 font-editorial text-[56px] font-medium leading-[1.1] tracking-tight max-w-[850px]" style={{ color: '#09090b', textWrap: 'balance' }}>
              {paper.title.length > 90 ? paper.title.substring(0, 87) + '...' : paper.title}
            </h1>
            
            <p className="font-editorial text-[24px] leading-relaxed max-w-[800px]" style={{ color: '#52525b', letterSpacing: 'normal', wordSpacing: 'normal' }}>
              {paper.abstract.substring(0, 220).trim()}...
            </p>
          </div>
          
          <div className="flex items-center justify-between border-t pt-6 mt-auto" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
            <div className="flex items-center gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-full border text-[18px] font-semibold" style={{ backgroundColor: '#f4f4f5', borderColor: 'rgba(0,0,0,0.1)', color: '#09090b' }}>
                {paper.authorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-[20px] font-semibold" style={{ color: '#09090b' }}>{paper.authorName}</div>
                <div className="text-[14px] font-medium" style={{ color: '#71717a' }}>{paper.year} · {paper.departmentName}</div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                {paper.keywords && paper.keywords.slice(0, 3).map((kw: string, i: number) => (
                  <span key={i} className="rounded-md px-2.5 py-1 font-data text-[10px] uppercase tracking-wider" style={{ backgroundColor: 'rgba(0,0,0,0.04)', color: '#52525b' }}>{kw}</span>
                ))}
              </div>
              <div className="flex items-center gap-2 font-data text-[12px] uppercase tracking-widest mt-1" style={{ color: '#a1a1aa' }}>
                <Link2 size={12} /> researchsphere.local/p/{paper.id.substring(0,8)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>}
  </main>;
}

function SubmitPage() {
  const { isAuthenticated, login } = useAuth();
  const qc = useQueryClient(); const { data: departments } = useListDepartments(); const { data: categories } = useListCategories();
  const request = useRequestUploadUrl(); const preview = usePreviewPaperMetadata(); const submit = useSubmitPaper(); const revision = useSubmitPaperRevision();
  const [file, setFile] = useState<File | null>(null); const [objectPath, setObjectPath] = useState(''); const [metadata, setMetadata] = useState<{ title: string; abstract: string; keywords: string[]; fileHash: string; duplicate: boolean } | null>(null);
  const [title, setTitle] = useState(''); const [abstract, setAbstract] = useState(''); const [keywords, setKeywords] = useState(''); const [departmentId, setDepartmentId] = useState(''); const [researchArea, setResearchArea] = useState(''); const [paperType, setPaperType] = useState(''); const [year, setYear] = useState(String(new Date().getFullYear())); const [doi, setDoi] = useState(''); const [error, setError] = useState('');

  if (!isAuthenticated) return <LoginPrompt title="Contribute to the archive" body="Log in to share original work with the university community." onLogin={login} />;

  const upload = async (f: File) => {
    if (f.type !== 'application/pdf') { setError('Choose a PDF document to continue.'); return; }
    setError(''); setFile(f);
    try {
      const signed = await request.mutateAsync({ data: { name: f.name, size: f.size, contentType: 'application/pdf' } });
      const res = await fetch(signed.uploadURL, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: f });
      if (!res.ok) throw new Error('The PDF could not be uploaded. Please try again.');
      setObjectPath(signed.objectPath);
      const extracted = await preview.mutateAsync({ data: { objectPath: signed.objectPath } });
      setMetadata(extracted); setTitle(extracted.title); setAbstract(extracted.abstract); setKeywords(extracted.keywords.join(', '));
      if (extracted.doi) setDoi(extracted.doi);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Please try again.'); setFile(null); }
  };
  const submitPaper = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!objectPath || !title.trim() || !departmentId || !researchArea || !paperType) { setError('Complete every required field and upload your PDF.'); return; }
    const input: PaperInput = { title: title.trim(), abstract, year: Number(year), departmentId, researchArea, paperType, doi: doi || null, objectPath, keywords: keywords.split(',').map(k => k.trim()).filter(Boolean) };
    submit.mutate({ data: input }, { onSuccess: () => { void qc.invalidateQueries({ queryKey: getListMySubmissionsQueryKey() }); setError(''); setFile(null); setObjectPath(''); setMetadata(null); setTitle(''); setAbstract(''); setKeywords(''); toast.success('Your paper was submitted for review.'); }, onError: () => setError('Submission could not be completed. Check the details and try again.') });
  };
  const areas = (Array.isArray(categories) ? categories : []).filter(c => c.kind === 'RESEARCH_AREA'); const types = (Array.isArray(categories) ? categories : []).filter(c => c.kind === 'PAPER_TYPE');
  return <main className="page-enter">
    <PageHeading eyebrow="Contribute to the archive" title="Submit research" subtitle="Share original work with the university community. Your PDF metadata will be extracted for you to review before submission." />
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form onSubmit={submitPaper} className="space-y-7">
        <section><SectionTitle number="01" title="Upload your paper" note="PDF · maximum file size is set by the repository" />
          <label onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); }} className="mt-4 flex min-h-[138px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/[.035] px-4 text-center transition hover:bg-primary/[.07]">
            <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
            {request.isPending || preview.isPending ? <><LoaderCircle className="mb-2 animate-spin text-primary" size={23} /><span className="text-[12px] font-semibold">Uploading & reading your paper</span><span className="mt-1 text-[10px] text-muted-foreground">This may take a moment</span></> : file && objectPath ? <><CheckCircle2 className="mb-2 text-primary" size={23} /><span className="text-[12px] font-semibold">{file.name}</span><span className="mt-1 text-[10px] text-muted-foreground">PDF uploaded · choose another file to replace</span></> : <><span className="mb-2 grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><Upload size={18} /></span><span className="text-[12px] font-semibold">Choose PDF or drop it here</span><span className="mt-1 text-[10px] text-muted-foreground">Direct, secure upload · PDF only</span></>}
          </label>
          {metadata && <div className={`mt-3 flex items-start gap-2 rounded-md px-3 py-2.5 text-[10px] ${metadata.duplicate ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}`}><Sparkles size={14} className="mt-0.5 shrink-0" /><span>{metadata.duplicate ? 'This document may already exist in the archive. Review the extracted details before continuing.' : 'We found the following details in your PDF. Please confirm or edit each field.'}</span></div>}
        </section>
        <section><SectionTitle number="02" title="Confirm paper details" note="Fields marked required are needed to submit" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Paper title *" className="sm:col-span-2"><input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter the full paper title" /></Field>
            <Field label="Abstract"><textarea value={abstract} onChange={e => setAbstract(e.target.value)} rows={5} placeholder="A concise summary of your research" className="resize-y" /></Field>
            <div className="space-y-4"><Field label="Department *"><select required value={departmentId} onChange={e => setDepartmentId(e.target.value)}><option value="">Select department</option>{(Array.isArray(departments) ? departments : []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="Research area *"><select required value={researchArea} onChange={e => setResearchArea(e.target.value)}><option value="">Select area</option>{areas.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></Field><Field label="Paper type *"><select required value={paperType} onChange={e => setPaperType(e.target.value)}><option value="">Select type</option>{types.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></Field></div>
            <Field label="Keywords · comma separated"><input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. fieldwork, ecology, policy" /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Publication year"><input type="number" min="1900" max="2100" value={year} onChange={e => setYear(e.target.value)} /></Field><Field label="DOI"><input value={doi} onChange={e => setDoi(e.target.value)} placeholder="10.xxxx/…" /></Field></div>
          </div>
          {metadata && <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3 font-data text-[9px] text-muted-foreground"><span>File hash: {metadata.fileHash}</span>{metadata.keywords?.length > 0 && <span>Extracted keywords: {metadata.keywords.join(', ')}</span>}</div>}
        </section>
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{error}</p>}
        <div className="flex items-center justify-between border-t border-border pt-5"><span className="text-[10px] text-muted-foreground">You'll be able to track review status in My submissions.</span><Button type="submit" disabled={submit.isPending || !objectPath}>{submit.isPending ? 'Submitting…' : 'Submit for review'}<ArrowRight size={14} /></Button></div>
      </form>
      <aside className="space-y-4"><div className="rounded-lg bg-sidebar p-5 text-sidebar-foreground"><div className="mb-3 flex items-center gap-2 font-data text-[9px] uppercase tracking-[.18em] text-sidebar-primary"><GraduationCap size={15} />Submission guide</div><h3 className="font-editorial text-2xl">A clear record starts here.</h3><p className="mt-2 text-[11px] leading-5 text-sidebar-foreground/70">Once submitted, a faculty reviewer will assess your paper for clarity, rigor, and fit with the repository.</p><ul className="mt-5 space-y-3 text-[10px] leading-4 text-sidebar-foreground/80"><li className="flex gap-2"><span className="font-data text-sidebar-primary">01</span>Upload the final, searchable PDF.</li><li className="flex gap-2"><span className="font-data text-sidebar-primary">02</span>Check extracted details carefully.</li><li className="flex gap-2"><span className="font-data text-sidebar-primary">03</span>Respond to revision requests in your submissions.</li></ul></div>{metadata?.fileHash && <div className="rounded-lg border border-border bg-card p-4"><div className="mb-1 font-data text-[9px] uppercase tracking-wider text-muted-foreground">Document fingerprint</div><code className="break-all text-[9px]">{metadata.fileHash}</code></div>}</aside>
    </div>
  </main>;
}

function SectionTitle({ number, title, note }: { number: string; title: string; note?: string }) { return <div className="flex items-baseline gap-3 border-b border-border pb-3"><span className="font-data text-[10px] text-primary">{number}</span><h2 className="font-editorial text-2xl">{title}</h2>{note && <span className="hidden text-[9px] text-muted-foreground sm:inline">{note}</span>}</div>; }
function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) { return <label className={`block text-[10px] font-semibold text-foreground/80 ${className}`}><span className="mb-1.5 block">{label}</span><div className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-input [&_input]:bg-card [&_input]:px-3 [&_input]:text-[11px] [&_input]:font-normal [&_input]:outline-none [&_input]:focus:border-primary [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-input [&_textarea]:bg-card [&_textarea]:p-3 [&_textarea]:text-[11px] [&_textarea]:font-normal [&_textarea]:outline-none [&_textarea]:focus:border-primary [&_select]:h-10 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-input [&_select]:bg-card [&_select]:px-3 [&_select]:text-[11px] [&_select]:font-normal [&_select]:outline-none [&_select]:focus:border-primary">{children}</div></label>; }

function PaperCollectionsManager({ paperId }: { paperId: string }) {
  const { data: collections } = useListMyCollections({ query: { queryKey: getListMyCollectionsQueryKey() }});
  const add = useAddPaperToCollection();
  const remove = useRemovePaperFromCollection();
  const qc = useQueryClient();
  
  if (!collections || collections.length === 0) return null;
  
  return (
    <div className="mt-4 border-t border-border pt-4">
      <h4 className="font-data text-[9px] uppercase tracking-wider text-muted-foreground mb-2">Add to Collection</h4>
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {collections.map(c => {
          const inColl = c.papers?.some(p => p.id === paperId);
          return (
            <label key={c.id} className="flex items-center gap-2 text-[11px] hover:bg-muted/50 p-1.5 rounded cursor-pointer">
              <input type="checkbox" checked={inColl} onChange={(e) => {
                const action = e.target.checked ? add : remove;
                action.mutate({ collectionId: c.id, paperId }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListMyCollectionsQueryKey() }) });
              }} className="rounded border-input text-primary focus:ring-primary h-3 w-3" />
              <Folder size={12} className={inColl ? 'text-primary fill-primary/20' : 'text-muted-foreground'}/>
              <span className="flex-1 truncate">{c.name}</span>
            </label>
          )
        })}
      </div>
    </div>
  );
}

function LibraryPage() {
  const { isAuthenticated, login } = useAuth();
  const { data: papers, isLoading, isError, refetch } = useListMyBookmarks({ query: { enabled: isAuthenticated, queryKey: getListMyBookmarksQueryKey(), retry: false } });
  const { data: collections, isLoading: collLoading } = useListMyCollections({ query: { enabled: isAuthenticated, queryKey: getListMyCollectionsQueryKey(), retry: false }});
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const [newCollName, setNewCollName] = useState('');
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  
  const remove = useRemoveBookmark(); const qc = useQueryClient();
  const [confirmData, setConfirmData] = useState<{ title: string; onConfirm: () => void; } | null>(null);
  
  if (!isAuthenticated) return <LoginPrompt title="Your personal reading shelf" body="Log in to keep the papers you want to return to." onLogin={login} />;
  return <main className="page-enter">
    <PageHeading eyebrow="Your research, gathered" title="My library" subtitle="A personal shelf of saved papers, ready when the next question comes." />
    
    <div className="mb-10 grid gap-6 md:grid-cols-[250px_1fr]">
      <aside className="space-y-6">
        <div>
          <h3 className="font-editorial text-xl mb-3 flex items-center gap-2"><Folder size={18} className="text-primary"/> Collections</h3>
          <ul className="space-y-2">
            <li className={`group flex cursor-pointer items-center justify-between rounded-md p-2 text-[11px] hover:bg-muted/50 ${!activeCollectionId ? 'bg-muted/50 font-semibold' : ''}`} onClick={() => setActiveCollectionId(null)}>
              <span className="font-medium text-foreground flex items-center gap-1.5"><Bookmark size={12} className="text-primary/70" /> All saved papers</span>
            </li>
            {(collections || []).map(c => (
              <li key={c.id} onClick={() => setActiveCollectionId(c.id)} className={`group flex cursor-pointer items-center justify-between rounded-md p-2 text-[11px] hover:bg-muted/50 ${activeCollectionId === c.id ? 'bg-muted/50 font-semibold' : ''}`}>
                <span className="font-medium text-foreground flex items-center gap-1.5"><Folder size={12} className="text-primary/70" /> {c.name} <span className="text-muted-foreground ml-1">({c.paperCount})</span></span>
                <button onClick={(e) => { e.stopPropagation(); setConfirmData({ title: `Delete collection '${c.name}'?`, onConfirm: () => { deleteCollection.mutate({ collectionId: c.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListMyCollectionsQueryKey() }); if(activeCollectionId === c.id) setActiveCollectionId(null); } }); } }); }} className="hidden text-destructive hover:underline group-hover:block" title="Delete Collection"><Trash2 size={12}/></button>
              </li>
            ))}
            {!collLoading && collections?.length === 0 && <li className="text-[10px] text-muted-foreground italic px-2">No collections yet</li>}
          </ul>
          <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); if(newCollName.trim()){ createCollection.mutate({ data: { name: newCollName } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListMyCollectionsQueryKey() }); setNewCollName(''); }}); } }}>
            <input value={newCollName} onChange={e => setNewCollName(e.target.value)} placeholder="New collection..." className="h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] outline-none focus:border-primary" />
            <Button kind="outline" type="submit" className="h-8 px-3 py-0" disabled={!newCollName.trim() || createCollection.isPending}><Plus size={14}/></Button>
          </form>
        </div>
      </aside>
      <div>
        {(() => {
          const activeCollection = collections?.find(c => c.id === activeCollectionId);
          const displayedPapers = activeCollectionId ? (activeCollection?.papers || []) : (Array.isArray(papers) ? papers : []);
          const isCollectionEmpty = activeCollectionId && displayedPapers.length === 0;
          return <>
            <div className="mb-4 flex items-center justify-between text-[10px] text-muted-foreground"><span>{displayedPapers.length} saved papers {activeCollectionId ? `in ${activeCollection?.name}` : ''}</span><span className="font-data uppercase tracking-wider">Private to you</span></div>
            <State loading={isLoading} error={isError} retry={() => refetch()}>
              <div>{displayedPapers.map(p => <PaperRow key={p.id} paper={p} compact bookmarked onBookmark={() => remove.mutate({ paperId: p.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListMyBookmarksQueryKey() }); qc.invalidateQueries({ queryKey: getListMyCollectionsQueryKey() }); }})} />)}</div>
            </State>
            {!isLoading && !isError && isCollectionEmpty && <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center"><Folder size={23} className="mx-auto mb-3 text-muted-foreground" /><div className="font-editorial text-xl">This collection is empty</div><p className="mt-1 text-xs text-muted-foreground">Go to a paper page and select this collection to add papers.</p></div>}
            {!isLoading && !isError && !activeCollectionId && displayedPapers.length === 0 && <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center"><Library size={23} className="mx-auto mb-3 text-primary" /><div className="font-editorial text-xl">Your library is waiting for its first paper</div><p className="mt-1 text-xs text-muted-foreground">Save papers from discovery and they'll be gathered here.</p><Link href="/" className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold text-primary no-underline">Explore papers <ArrowRight size={13} /></Link></div>}
          </>;
        })()}
      </div>
    </div>
      {confirmData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="mb-6 font-editorial text-xl">{confirmData.title}</h2>
            <div className="flex justify-end gap-2">
              <Button kind="quiet" onClick={() => setConfirmData(null)}>Cancel</Button>
              <Button onClick={() => { confirmData.onConfirm(); setConfirmData(null); }} className="bg-red-600 text-white hover:bg-red-700 border-none">Delete</Button>
            </div>
          </div>
        </div>
      )}
  </main>;
}

function SubmissionsPage() {
  const { isAuthenticated, login } = useAuth();
  const { data: papers, isLoading, isError, refetch } = useListMySubmissions({ query: { enabled: isAuthenticated, queryKey: getListMySubmissionsQueryKey(), retry: false } });
  const { data: analytics, isLoading: analyticsLoading } = useGetMyAnalytics({ query: { enabled: isAuthenticated, queryKey: getGetMyAnalyticsQueryKey(), retry: false } });
  const [editing, setEditing] = useState<Paper | null>(null);

  if (!isAuthenticated) return <LoginPrompt title="Track your research" body="Log in to see submission status and respond to reviewer feedback." onLogin={login} />;

  return <main className="page-enter">
    <PageHeading eyebrow="Research you've shared" title="My submissions" subtitle="Follow each paper through review and keep your latest version in one place." action={<Link href="/submit" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-[11px] font-semibold text-primary-foreground no-underline"><Plus size={14} />New submission</Link>} />
    
    {!analyticsLoading && analytics && (
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2"><BarChart3 size={15} className="text-primary"/><h2 className="font-editorial text-[22px]">Author Analytics</h2></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-2 font-data text-[9px] uppercase tracking-wider text-muted-foreground"><Eye size={13}/> Total views</div><div className="mt-3 font-editorial text-[38px] leading-none">{analytics.totalViews}</div></div>
          <div className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-2 font-data text-[9px] uppercase tracking-wider text-muted-foreground"><ArrowDownToLine size={13}/> Downloads</div><div className="mt-3 font-editorial text-[38px] leading-none">{analytics.totalDownloads}</div></div>
          <div className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-2 font-data text-[9px] uppercase tracking-wider text-muted-foreground"><Bookmark size={13}/> Bookmarks</div><div className="mt-3 font-editorial text-[38px] leading-none">{analytics.totalBookmarks}</div></div>
        </div>
        
        {analytics.papers.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[500px] text-left">
              <thead>
                <tr className="border-b border-border font-data text-[9px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-normal">Paper</th>
                  <th className="w-24 px-4 py-3 text-right font-normal">Views</th>
                  <th className="w-24 px-4 py-3 text-right font-normal">Downloads</th>
                  <th className="w-24 px-4 py-3 text-right font-normal">Bookmarks</th>
                </tr>
              </thead>
              <tbody className="text-[11px]">
                {analytics.papers.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium"><Link href={`/papers/${p.id}`} className="no-underline hover:text-primary">{p.title}</Link></td>
                    <td className="px-4 py-3 text-right font-data">{p.views}</td>
                    <td className="px-4 py-3 text-right font-data">{p.downloads}</td>
                    <td className="px-4 py-3 text-right font-data">{p.bookmarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )}

    <div className="mb-4"><h2 className="font-editorial text-[22px]">Submission History</h2></div>
    <State loading={isLoading} error={isError} retry={() => refetch()} empty="No submissions yet.">
      <div className="space-y-3">
        {(Array.isArray(papers) ? papers : []).map(p => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"><FileText size={17} /></span>
                <div>
                  <Link href={`/papers/${p.id}`} className="font-editorial text-xl leading-tight no-underline hover:text-primary">{p.title}</Link>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    <span>{p.departmentName}</span><span>{p.year}</span><span>Version {p.versionNumber}</span><span>Submitted {new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <StatusBadge status={p.status} />
            </div>
            {p.status === 'REJECTED' && (p as any).rejectionReason && <div className="mt-4 rounded-md border-l-2 border-red-500 bg-red-500/10 px-3 py-2.5"><div className="mb-1 font-data text-[9px] uppercase tracking-wider text-red-600">Removal Reason</div><p className="text-[11px] leading-5 text-foreground/80">{(p as any).rejectionReason}</p></div>}
            {p.latestReviewComment && <div className="mt-4 rounded-md border-l-2 border-accent-foreground bg-accent/50 px-3 py-2.5"><div className="mb-1 font-data text-[9px] uppercase tracking-wider text-accent-foreground">Reviewer note</div><p className="text-[11px] leading-5 text-foreground/80">{p.latestReviewComment}</p></div>}
            {p.versions && p.versions.length > 1 && (
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-2 font-data text-[9px] uppercase tracking-wider text-muted-foreground">Version history</div>
                <div className="space-y-1">
                  {p.versions.map((v: any) => (
                    <div key={v.versionNumber} className="flex items-center justify-between text-[11px]">
                      <span>Version {v.versionNumber} {v.versionNumber === p.versionNumber && <span className="ml-1 text-[9px] text-primary">(Current)</span>}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{new Date(v.createdAt).toLocaleDateString()}</span>
                        {v.objectPath && <a href={`/api/storage/objects/${v.objectPath}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">PDF</a>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {p.status === 'REVISION_REQUIRED' && <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-3"><span className="text-[10px] text-muted-foreground">Upload a revised PDF to continue review.</span><Button kind="outline" onClick={() => setEditing(p)}><Upload size={14} />Upload revision</Button></div>}
          </div>
        ))}
      </div>
    </State>
    {editing && <RevisionDialog paper={editing} close={() => setEditing(null)} />}
  </main>;
}
function StatusBadge({ status }: { status: string }) { const s: Record<string, string> = { APPROVED: 'bg-primary/10 text-primary', PENDING_REVIEW: 'bg-secondary text-secondary-foreground', REVISION_REQUIRED: 'bg-accent text-accent-foreground', REJECTED: 'bg-destructive/10 text-destructive' }; const label: Record<string, string> = { APPROVED: 'Approved', PENDING_REVIEW: 'In review', REVISION_REQUIRED: 'Revision requested', REJECTED: 'Not approved' }; return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-semibold ${s[status] || 'bg-muted text-muted-foreground'}`}><span className="size-1.5 rounded-full bg-current" />{label[status] || status}</span>; }
function RevisionDialog({ paper, close }: { paper: Paper; close: () => void }) {
  const qc = useQueryClient(); const req = useRequestUploadUrl(); const rev = useSubmitPaperRevision();
  const [file, setFile] = useState<File | null>(null); const [path, setPath] = useState(''); const [error, setError] = useState('');
  const [title, setTitle] = useState(paper.title);
  const [abstract, setAbstract] = useState(paper.abstract);
  const [keywords, setKeywords] = useState(paper.keywords?.join(', ') || '');
  const upload = async (f: File) => { if (f.type !== 'application/pdf') { setError('Please choose a PDF.'); return; } setFile(f); setError(''); try { const r = await req.mutateAsync({ data: { name: f.name, size: f.size, contentType: 'application/pdf' } }); const res = await fetch(r.uploadURL, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: f }); if (!res.ok) throw new Error('Upload failed'); setPath(r.objectPath); } catch { setError('The PDF could not be uploaded. Please try again.'); } };
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-sidebar/55 p-4 py-12"><div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-xl"><div className="flex items-start justify-between"><div><div className="font-data text-[9px] uppercase tracking-wider text-primary">Revision · v{paper.versionNumber + 1}</div><h3 className="mt-1 font-editorial text-2xl">Upload revised paper</h3></div><button onClick={close} aria-label="Close" className="rounded p-1 hover:bg-muted"><X size={18} /></button></div><div className="mt-5 space-y-4"><Field label="Paper title *"><input required value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-[12px]" /></Field><Field label="Abstract *"><textarea required value={abstract} onChange={e => setAbstract(e.target.value)} rows={3} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-[12px]" /></Field><Field label="Keywords · comma separated"><input value={keywords} onChange={e => setKeywords(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-[12px]" /></Field><div><span className="mb-1 block font-data text-[10px] uppercase tracking-wider text-muted-foreground">Revised PDF *</span><label className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-primary/40 bg-primary/[.035] px-5 py-6 text-center"><input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} /><Upload size={20} className="mb-2 text-primary" /><span className="text-[11px] font-semibold">{file?.name || 'Choose revised PDF'}</span><span className="mt-1 text-[9px] text-muted-foreground">PDF only</span></label></div></div>{error && <p className="mt-3 text-[10px] text-destructive">{error}</p>}<div className="mt-6 flex justify-end gap-2"><Button kind="quiet" onClick={close}>Cancel</Button><Button disabled={!path || !title.trim() || !abstract.trim() || rev.isPending} onClick={() => rev.mutate({ paperId: paper.id, data: { title: title.trim(), abstract: abstract.trim(), objectPath: path, keywords: keywords.split(',').map(k => k.trim()).filter(Boolean) } }, { onSuccess: () => { void qc.invalidateQueries({ queryKey: getListMySubmissionsQueryKey() }); close(); }, onError: () => setError('The revision could not be submitted.') })}>{rev.isPending ? 'Submitting…' : 'Submit revision'}</Button></div></div></div>;
}

function ReviewPage() {
  const { isAuthenticated, login } = useAuth(); const { data: profile } = useGetMyProfile({ query: { enabled: isAuthenticated, queryKey: getGetMyProfileQueryKey(), retry: false } });
  const { data: queue, isLoading, isError, refetch } = useListReviewQueue({ query: { enabled: isAuthenticated, queryKey: getListReviewQueueQueryKey(), retry: false } });
  const [active, setActive] = useState<Paper | null>(null); const [comments, setComments] = useState(''); const [reviewError, setReviewError] = useState(''); const review = useReviewPaper(); const qc = useQueryClient();
  if (!isAuthenticated) return <LoginPrompt title="Faculty review" body="Log in with your university account to access the review queue." onLogin={login} />;
  if (profile && profile.role === 'STUDENT') return <NoAccess text="The review queue is available to faculty reviewers and administrators." />;
  const decide = (status: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED') => { if (!active) return; if (!comments.trim()) { setReviewError('A note to the author is required before a decision.'); return; } setReviewError(''); review.mutate({ paperId: active.id, data: { status, comments } }, { onSuccess: () => { qc.setQueryData(getListReviewQueueQueryKey(), (old: any) => Array.isArray(old) ? old.filter((p: any) => p.id !== active.id) : old); void qc.invalidateQueries({ queryKey: getListReviewQueueQueryKey() }); void qc.invalidateQueries({ queryKey: getListPapersQueryKey() }); void qc.invalidateQueries({ queryKey: getListMySubmissionsQueryKey() }); setActive(null); setComments(''); }, onError: () => setReviewError('Review action failed. Please retry.') }); };
  return <>
    <main className="page-enter"><PageHeading eyebrow="Faculty workspace" title="Review queue" subtitle="Read with care. Leave a clear, useful record for each author." /><div className="mb-5 flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3"><Clock3 size={15} className="text-primary" /><span className="text-[11px]">{queue?.length || 0} papers awaiting review</span><span className="ml-auto font-data text-[9px] uppercase tracking-wider text-muted-foreground">Assigned queue</span></div>
      <State loading={isLoading} error={isError} retry={() => refetch()} empty="The queue is clear. Thank you for your reviews."><div>{(Array.isArray(queue) ? queue : []).map(p => <div key={p.id} className="border-b border-border py-5 first:border-t"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="mb-1 font-data text-[9px] uppercase tracking-wider text-muted-foreground">{p.departmentName} · {p.researchArea}</div><Link href={`/papers/${p.id}`} className="font-editorial text-[23px] no-underline hover:text-primary">{p.title}</Link><div className="mt-2 text-[10px] text-muted-foreground">{p.authorName} · Submitted {new Date(p.createdAt).toLocaleDateString()} · Version {p.versionNumber}</div></div><Button kind="outline" onClick={() => { setActive(p); setComments(''); }}>Review paper <ArrowRight size={14} /></Button></div><p className="mt-3 max-w-4xl line-clamp-2 text-[11px] leading-5 text-muted-foreground">{p.abstract}</p></div>)}</div></State>
    </main>
    {active && (
      <div className="fixed inset-0 z-[100] flex bg-background/80 p-4 backdrop-blur-sm sm:p-6 md:left-[254px] lg:p-8">
        <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl ring-1 ring-black/5">
          <div className="flex shrink-0 items-start justify-between border-b border-border bg-muted/30 px-6 py-5">
            <div>
              <div className="font-data text-[10px] font-semibold uppercase tracking-widest text-primary">Review paper</div>
              <h2 className="mt-1 font-editorial text-[24px] leading-tight line-clamp-1">{active.title}</h2>
            </div>
            <button onClick={() => setActive(null)} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close review"><X size={20} /></button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-0 md:flex-row">
            <div className="relative flex flex-[1.6] flex-col border-b border-border bg-muted/10 p-5 md:border-b-0 md:border-r">
              <div className="absolute inset-0 flex flex-col p-5">
                <div className="flex-1 overflow-hidden rounded-xl border border-border bg-white shadow-sm ring-1 ring-black/5">
                  {active.objectPath && <iframe src={`/api/storage/objects/${active.objectPath}`} className="h-full w-full border-0" title="Paper PDF" />}
                </div>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
              <h3 className="mb-3 font-data text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Abstract</h3>
              <div className="shrink-0 rounded-xl bg-muted/40 p-5 text-[12px] leading-relaxed text-muted-foreground">
                {active.abstract}
              </div>
              {active.versions && active.versions.length > 1 && (
                <div className="mt-6 border-t border-border pt-5">
                  <h3 className="mb-3 font-data text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Version history</h3>
                  <div className="space-y-2">
                    {active.versions.map((v: any) => (
                      <div key={v.versionNumber} className="flex items-center justify-between text-[11px]">
                        <span>Version {v.versionNumber} {v.versionNumber === active.versionNumber && <span className="ml-1 text-[9px] text-primary">(Current)</span>}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{new Date(v.createdAt).toLocaleDateString()}</span>
                          {v.objectPath && <a href={`/api/storage/objects/${v.objectPath}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">PDF</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <label className="mt-6 flex min-h-[140px] flex-1 flex-col border-t border-border pt-5">
                <span className="mb-3 font-data text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Comments for the author</span>
                <textarea value={comments} onChange={e => { setComments(e.target.value); setReviewError(''); }} placeholder="Share specific, constructive feedback…" className="w-full flex-1 resize-none rounded-xl border border-input bg-card p-4 text-[12px] leading-relaxed shadow-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              {reviewError && <p role="alert" className="mt-3 text-[11px] font-medium text-destructive">{reviewError}</p>}
              <div className="mt-8 flex shrink-0 flex-wrap justify-end gap-3 border-t border-border/50 pt-5">
                <Button kind="quiet" onClick={() => setActive(null)}>Cancel</Button>
                <Button kind="danger" disabled={review.isPending} onClick={() => decide('REJECTED')}>Decline</Button>
                <Button kind="outline" disabled={review.isPending} onClick={() => decide('REVISION_REQUIRED')}>Request revision</Button>
                <Button disabled={review.isPending} onClick={() => decide('APPROVED')}><Check size={15} />Approve</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </>;
}

function AdminPage() {
  const { isAuthenticated, login } = useAuth(); const { data: profile } = useGetMyProfile({ query: { enabled: isAuthenticated, queryKey: getGetMyProfileQueryKey(), retry: false } });
  const { data: analytics, isLoading: al, isError: ae, refetch: ra } = useGetAdminAnalytics({ query: { enabled: isAuthenticated, queryKey: getGetAdminAnalyticsQueryKey(), retry: false } });
  const { data: departments, isLoading: dl, isError: de, refetch: rd } = useListDepartments({ query: { enabled: isAuthenticated, queryKey: getListDepartmentsQueryKey() } });
  const { data: areas } = useListCategories({ kind: 'RESEARCH_AREA' }); const { data: types } = useListCategories({ kind: 'PAPER_TYPE' });
  const { data: users, isLoading: ul, isError: ue, refetch: ru } = useListAdminUsers({ query: { enabled: isAuthenticated, queryKey: getListAdminUsersQueryKey(), retry: false } });
  const qc = useQueryClient(); const [newDept, setNewDept] = useState(false); const [newCategory, setNewCategory] = useState<'RESEARCH_AREA' | 'PAPER_TYPE' | null>(null);
  const createUser = useCreateAdminUser(); const [newUser, setNewUser] = useState(false); const createDept = useCreateDepartment(); const updateDept = useUpdateDepartment(); const deleteDept = useDeleteDepartment();
  const createCat = useCreateCategory(); const updateCat = useUpdateCategory(); const deleteCat = useDeleteCategory(); const updateRole = useUpdateUserRole();
  const [promptData, setPromptData] = useState<{ title: string; fields: { name: string; label: string; defaultValue: string; }[]; onConfirm: (data: Record<string, string>) => void; } | null>(null);
  const [confirmData, setConfirmData] = useState<{ title: string; onConfirm: () => void; } | null>(null);
  if (!isAuthenticated) return <LoginPrompt title="Repository administration" body="Log in with an administrator account to manage the academic archive." onLogin={login} />;
  if (profile && profile.role !== 'ADMIN') return <NoAccess text="This workspace is reserved for repository administrators." />;
  const invalidate = () => { void qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey() }); void qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() }); void qc.invalidateQueries({ queryKey: getGetAdminAnalyticsQueryKey() }); void qc.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }); };
  const deptCreate = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createDept.mutate({ data: { name: String(fd.get('name')), code: String(fd.get('code')).toUpperCase() } }, { onSuccess: () => { setNewDept(false); invalidate(); } }); };

  const userCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createUser.mutate({
      data: {
        firstName: String(fd.get('firstName')),
        lastName: String(fd.get('lastName')),
        email: String(fd.get('email')),
        password: String(fd.get('password')),
        role: String(fd.get('role')) as UserRole,
        departmentId: fd.get('departmentId') ? String(fd.get('departmentId')) : null
      }
    }, {
      onSuccess: () => {
        setNewUser(false);
        invalidate();
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.error || 'Failed to create user');
      }
    });
  };


  const categoryCreate = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); if (!newCategory) return; const fd = new FormData(e.currentTarget); createCat.mutate({ data: { kind: newCategory, name: String(fd.get('name')) } }, { onSuccess: () => { setNewCategory(null); invalidate(); } }); };
  
  const editDepartment = (d: Department) => {
    setPromptData({
      title: 'Edit Department',
      fields: [
        { name: 'name', label: 'Department Name', defaultValue: d.name },
        { name: 'code', label: 'Department Code', defaultValue: d.code }
      ],
      onConfirm: (data) => {
        if (!data.name || !data.code) return;
        updateDept.mutate({ departmentId: d.id, data: { name: data.name, code: data.code.toUpperCase() } }, { onSuccess: invalidate });
      }
    });
  };

  const editCategory = (c: Category) => {
    setPromptData({
      title: 'Edit Category',
      fields: [
        { name: 'name', label: 'Category Name', defaultValue: c.name }
      ],
      onConfirm: (data) => {
        if (!data.name) return;
        updateCat.mutate({ categoryId: c.id, data: { kind: c.kind, name: data.name } }, { onSuccess: invalidate });
      }
    });
  };

  const confirmDelete = (title: string, onConfirm: () => void) => {
    setConfirmData({ title, onConfirm });
  };
  const chart = (groups: { label: string; count: number }[] | undefined) => groups?.length ? <div className="space-y-3">{groups.map(g => <div key={g.label}><div className="mb-1 flex justify-between text-[10px]"><span>{g.label}</span><span className="font-data text-muted-foreground">{g.count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(3, (g.count / Math.max(...groups.map(x => x.count), 1)) * 100))}%` }} /></div></div>)}</div> : <p className="text-[10px] text-muted-foreground">No data available yet.</p>;
  const listTop = (items: { id: string; title: string; count: number }[] | undefined, label: string) => items?.length ? <div className="space-y-3">{items.map(item => <div key={item.id} className="flex flex-col gap-1 border-b border-border pb-2 last:border-0 last:pb-0"><Link href={`/papers/${item.id}`} className="line-clamp-2 text-[11px] font-medium no-underline hover:text-primary">{item.title}</Link><span className="font-data text-[9px] text-muted-foreground">{item.count} {label}</span></div>)}</div> : <p className="text-[10px] text-muted-foreground">No data available yet.</p>;

  return <main className="page-enter">
    <PageHeading 
      eyebrow="Repository operations" 
      title="Administration" 
      subtitle="A clear view of archive activity, academic structure, and access." 
      action={<a href="/api/admin/analytics/export" download className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted"><ArrowDownToLine size={15} />Export CSV</a>}
    />
    <State loading={al} error={ae} retry={() => ra()}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Papers in archive', analytics?.totalPapers], ['Community members', analytics?.totalUsers], ['Departments', analytics?.departmentsCount], ['Views & downloads', analytics?.totalViewsDownloads]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-border bg-card p-4"><div className="font-data text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-2 font-editorial text-[34px] leading-none">{value ?? '—'}</div></div>)}</div></State>
    <div className="mt-6 grid gap-4 lg:grid-cols-3"><AdminPanel title="Papers by department">{chart(analytics?.papersByDepartment)}</AdminPanel><AdminPanel title="Papers by year">{chart(analytics?.papersByYear)}</AdminPanel><AdminPanel title="Submission status">{chart(analytics?.submissionsByStatus)}</AdminPanel></div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <AdminPanel title="Most viewed papers">{listTop(analytics?.mostViewedPapers, 'views')}</AdminPanel>
      <AdminPanel title="Most downloaded papers">{listTop(analytics?.mostDownloadedPapers, 'downloads')}</AdminPanel>
    </div>
    <div className="mt-9 grid gap-8 xl:grid-cols-[1fr_1fr]">
      <section><div className="mb-4 flex items-end justify-between"><div><div className="font-data text-[9px] uppercase tracking-[.16em] text-primary">Academic structure</div><h2 className="mt-1 font-editorial text-[25px]">Departments</h2></div><Button kind="outline" onClick={() => setNewDept(v => !v)}><Plus size={14} />Add department</Button></div>
        {newDept && <form onSubmit={deptCreate} className="mb-3 flex flex-wrap gap-2 rounded-lg border border-primary/25 bg-primary/[.04] p-3"><input name="name" required placeholder="Department name" className="h-9 min-w-32 flex-1 rounded border border-input bg-card px-2 text-[10px]" /><input name="code" required minLength={2} placeholder="Code" className="h-9 w-24 rounded border border-input bg-card px-2 text-[10px]" /><Button type="submit" disabled={createDept.isPending}>{createDept.isPending ? 'Saving' : 'Save'}</Button><Button kind="quiet" onClick={() => setNewDept(false)}>Cancel</Button></form>}
        <State loading={dl} error={de} retry={() => rd()} empty="No departments configured."><div className="divide-y divide-border rounded-lg border border-border bg-card">{(Array.isArray(departments) ? departments : []).map(d => <div key={d.id} className="flex items-center gap-3 px-3 py-3"><span className="grid size-8 place-items-center rounded bg-secondary font-data text-[9px] text-secondary-foreground">{d.code}</span><span className="flex-1 text-[11px] font-medium">{d.name}</span><button title="Edit department" onClick={() => editDepartment(d)} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Pencil size={14} /></button><button title="Delete department" onClick={() => confirmDelete(`Delete ${d.name}?`, () => deleteDept.mutate({ departmentId: d.id }, { onSuccess: invalidate }))} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button></div>)}</div></State>
      </section>
      <section><div className="mb-4 flex items-end justify-between"><div><div className="font-data text-[9px] uppercase tracking-[.16em] text-primary">Browse taxonomy</div><h2 className="mt-1 font-editorial text-[25px]">Categories</h2></div></div>
        <div className="grid gap-4 sm:grid-cols-2">{([{ label: 'Research areas', list: Array.isArray(areas) ? areas : [], kind: 'RESEARCH_AREA' as const }, { label: 'Paper types', list: Array.isArray(types) ? types : [], kind: 'PAPER_TYPE' as const }]).map(group => <div key={group.kind} className="rounded-lg border border-border bg-card p-3"><div className="mb-2 flex items-center justify-between"><span className="font-data text-[9px] uppercase tracking-wider text-muted-foreground">{group.label}</span><button onClick={() => setNewCategory(group.kind)} title={`Add ${group.label.toLowerCase()}`} className="rounded p-1 text-primary hover:bg-muted"><Plus size={14} /></button></div>{group.list.map(c => <div key={c.id} className="flex items-center gap-2 border-t border-border py-2 text-[10px]"><span className="flex-1">{c.name}</span><button title="Edit category" onClick={() => editCategory(c)} className="rounded p-1 text-muted-foreground hover:bg-muted"><Pencil size={12} /></button><button title="Delete category" onClick={() => confirmDelete(`Delete ${c.name}?`, () => deleteCat.mutate({ categoryId: c.id }, { onSuccess: invalidate }))} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button></div>)}</div>)}</div>
        {newCategory && <form onSubmit={categoryCreate} className="mt-3 flex gap-2 rounded-lg border border-primary/25 bg-primary/[.04] p-3"><input name="name" required placeholder={`New ${newCategory === 'RESEARCH_AREA' ? 'research area' : 'paper type'}`} className="h-9 min-w-0 flex-1 rounded border border-input bg-card px-2 text-[10px]" /><Button type="submit" disabled={createCat.isPending}>Save</Button><Button kind="quiet" onClick={() => setNewCategory(null)}>Cancel</Button></form>}
      </section>
    </div>
    <section className="mt-10"><div className="mb-4"><div className="font-data text-[9px] uppercase tracking-[.16em] text-primary">Access & roles</div><h2 className="mt-1 font-editorial text-[25px]">People</h2></div>

      <div className="mb-4 flex items-end justify-between mt-6">
        <div><h3 className="font-editorial text-[20px]">Staff Accounts</h3></div>
        <Button kind="outline" onClick={() => setNewUser(v => !v)}><Plus size={14} />Add User</Button>
      </div>
      {newUser && <form onSubmit={userCreate} className="mb-4 grid gap-2 rounded-lg border border-primary/25 bg-primary/[.04] p-3 sm:grid-cols-2">
        <input name="firstName" required placeholder="First name" className="h-9 rounded border border-input bg-card px-2 text-[10px]" />
        <input name="lastName" required placeholder="Last name" className="h-9 rounded border border-input bg-card px-2 text-[10px]" />
        <input name="email" type="email" required placeholder="Email" className="h-9 rounded border border-input bg-card px-2 text-[10px]" />
        <input name="password" type="password" required placeholder="Temporary password" className="h-9 rounded border border-input bg-card px-2 text-[10px]" />
        <select name="role" required className="h-9 rounded border border-input bg-card px-2 text-[10px]">
          <option value="REVIEWER">Reviewer</option>
          <option value="ADMIN">Administrator</option>
        </select>
        <select name="departmentId" className="h-9 rounded border border-input bg-card px-2 text-[10px]">
          <option value="">No department</option>
          {(Array.isArray(departments) ? departments : []).map(d => <option value={d.id} key={d.id}>{d.name}</option>)}
        </select>
        <div className="col-span-full flex gap-2 mt-2">
          <Button type="submit" disabled={createUser.isPending}>{createUser.isPending ? 'Saving' : 'Create User'}</Button>
          <Button kind="quiet" type="button" onClick={() => setNewUser(false)}>Cancel</Button>
        </div>
      </form>}

      <State loading={ul} error={ue} retry={() => ru()} empty="No user profiles found."><div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-[640px] text-left"><thead><tr className="border-b border-border font-data text-[9px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3 font-normal">Person</th><th className="px-4 py-3 font-normal">Department</th><th className="px-4 py-3 font-normal">Role</th><th className="px-4 py-3 font-normal">Actions</th></tr></thead><tbody>{(Array.isArray(users) ? users : []).map(u => <UserRow key={u.id} user={u} departments={departments || []} onChange={(role, departmentId) => updateRole.mutate({ userId: u.id, data: { role, departmentId } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }) })} onSuspend={() => { fetch(`/api/admin/users/${u.id}/${(u as any).isSuspended ? 'unsuspend' : 'suspend'}`, { method: 'POST' }).then(() => qc.invalidateQueries({ queryKey: getListAdminUsersQueryKey() })); }} />)}</tbody></table></div></State>
    </section>
    {promptData && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
        <form onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const data: Record<string, string> = {};
          promptData.fields.forEach(f => data[f.name] = String(fd.get(f.name)));
          promptData.onConfirm(data);
          setPromptData(null);
        }} className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
          <h2 className="mb-4 font-editorial text-xl">{promptData.title}</h2>
          <div className="space-y-3 mb-6">
            {promptData.fields.map(f => (
              <div key={f.name}>
                <label className="mb-1 block font-data text-[9px] uppercase tracking-wider text-muted-foreground">{f.label}</label>
                <input name={f.name} defaultValue={f.defaultValue} required className="w-full rounded border border-input bg-background px-3 py-2 text-[12px]" autoFocus={f === promptData.fields[0]} />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button kind="quiet" type="button" onClick={() => setPromptData(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </div>
    )}
    {confirmData && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
          <h2 className="mb-6 font-editorial text-xl">{confirmData.title}</h2>
          <div className="flex justify-end gap-2">
            <Button kind="quiet" onClick={() => setConfirmData(null)}>Cancel</Button>
            <Button onClick={() => { confirmData.onConfirm(); setConfirmData(null); }} className="bg-red-600 text-white hover:bg-red-700 border-none">Delete</Button>
          </div>
        </div>
      </div>
    )}
  </main>;
}
function AdminPanel({ title, children }: { title: string; children: ReactNode }) { return <div className="rounded-lg border border-border bg-card p-4"><h3 className="mb-4 font-editorial text-xl">{title}</h3>{children}</div>; }
function UserRow({ user, departments, onChange, onSuspend }: { user: AdminUser; departments: Department[]; onChange: (role: UserRole, departmentId: string | null) => void; onSuspend: () => void }) {
  return <tr className="border-b border-border last:border-0"><td className="px-4 py-3"><div className="text-[11px] font-medium">{user.name}</div><div className="mt-0.5 text-[9px] text-muted-foreground">{user.email}</div></td><td className="px-4 py-3"><select aria-label={`Department for ${user.name}`} value={user.departmentId || ''} onChange={e => onChange(user.role, e.target.value || null)} className="max-w-44 rounded border border-input bg-background px-2 py-1.5 text-[10px]"><option value="">No department</option>{departments.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></td><td className="px-4 py-3"><select aria-label={`Role for ${user.name}`} value={user.role} onChange={e => onChange(e.target.value as UserRole, user.departmentId)} className="rounded border border-input bg-background px-2 py-1.5 text-[10px]"><option value="STUDENT">Student</option><option value="REVIEWER">Reviewer</option><option value="ADMIN">Administrator</option></select></td><td className="px-4 py-3"><Button kind="outline" onClick={onSuspend}>{(user as any).isSuspended ? 'Unsuspend' : 'Suspend'}</Button></td></tr>;
}
function ProfileEditor({ profile, user, departments, onClose }: { profile: any; user: any; departments: Department[]; onClose: () => void }) {
  const updateProfile = useUpdateProfile();
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [departmentId, setDepartmentId] = useState(profile?.departmentId || '');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ data: { firstName, lastName, departmentId: departmentId || null } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        onClose();
      }
    });
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-editorial text-2xl">Edit Profile</h2>
        <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X size={18} /></button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">First Name</label>
          <input required value={firstName} onChange={e => setFirstName(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">Last Name</label>
          <input required value={lastName} onChange={e => setLastName(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">Department</label>
          <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary">
            <option value="">No department</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-border">
          <Button type="button" kind="quiet" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={updateProfile.isPending}>{updateProfile.isPending ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </form>
    </div>
  </div>;
}

function LoginPrompt({ title, body, onLogin }: { title: string; body: string; onLogin: () => void }) { return <main className="page-enter grid min-h-[65vh] place-items-center"><div className="max-w-md rounded-xl border border-border bg-card p-8 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground"><GraduationCap size={21} /></span><h1 className="mt-4 font-editorial text-3xl">{title}</h1><p className="mt-2 text-[12px] leading-5 text-muted-foreground">{body}</p><Button onClick={onLogin} className="mt-5">Log in to continue <ArrowRight size={14} /></Button></div></main>; }
function NoAccess({ text }: { text: string }) { return <main className="page-enter grid min-h-[55vh] place-items-center"><div className="max-w-md text-center"><ShieldCheck size={25} className="mx-auto text-primary" /><h1 className="mt-3 font-editorial text-3xl">Access restricted</h1><p className="mt-2 text-[12px] leading-5 text-muted-foreground">{text}</p><Link href="/" className="mt-4 inline-block text-[11px] font-semibold text-primary no-underline">Return to discovery</Link></div></main>; }

function AuthorPage() {
  const params = useParams();
  const userId = params.userId!;
  const { data: author, isLoading, isError, refetch } = useGetAuthorProfile(userId, { query: { queryKey: getGetAuthorProfileQueryKey(userId), retry: false } });

  return <main className="page-enter">
    <State loading={isLoading} error={isError} retry={() => refetch()}>
      {author && <>
        <PageHeading 
          eyebrow="Author Profile" 
          title={author.name} 
          subtitle={author.departmentName || 'Independent Researcher'} 
        />
        
        <div className="mb-10 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="font-data text-[9px] uppercase tracking-wider text-muted-foreground">Papers</div>
            <div className="mt-2 font-editorial text-[34px] leading-none">{author.paperCount}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="font-data text-[9px] uppercase tracking-wider text-muted-foreground">Total Views</div>
            <div className="mt-2 font-editorial text-[34px] leading-none">{author.totalViews}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="font-data text-[9px] uppercase tracking-wider text-muted-foreground">Total Downloads</div>
            <div className="mt-2 font-editorial text-[34px] leading-none">{author.totalDownloads}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="font-data text-[9px] uppercase tracking-wider text-muted-foreground">Bookmarks</div>
            <div className="mt-2 font-editorial text-[34px] leading-none">{author.totalBookmarks}</div>
          </div>
        </div>

        <h2 className="mb-4 font-editorial text-[25px]">Published Papers</h2>
        <div className="rounded-lg border border-border bg-card shadow-sm">
          {author.papers.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-muted-foreground">No approved papers yet.</div>
          ) : (
            author.papers.map(p => <div key={p.id} className="px-5"><PaperRow paper={p} /></div>)
          )}
        </div>
      </>}
    </State>
  </main>;
}

function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] bg-background/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[600px] overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
        <Command label="Global Command Menu" className="flex h-full w-full flex-col bg-transparent">
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input 
              autoFocus
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50" 
              placeholder="Type a command or search..." 
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
            <Command.Empty className="py-6 text-center text-sm">No results found.</Command.Empty>
            <Command.Group heading="Navigation" className="px-2 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:mb-2 [&_[cmdk-group-heading]]:px-2">
              <Command.Item onSelect={() => { setLocation('/'); setOpen(false); }} className="flex cursor-pointer items-center rounded-sm px-2 py-2.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"><Search className="mr-2 h-4 w-4" /> Discover Papers</Command.Item>
              <Command.Item onSelect={() => { setLocation('/submit'); setOpen(false); }} className="flex cursor-pointer items-center rounded-sm px-2 py-2.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"><Upload className="mr-2 h-4 w-4" /> Submit Research</Command.Item>
              <Command.Item onSelect={() => { setLocation('/library'); setOpen(false); }} className="flex cursor-pointer items-center rounded-sm px-2 py-2.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"><Library className="mr-2 h-4 w-4" /> My Library</Command.Item>
            </Command.Group>
            <Command.Group heading="Settings" className="px-2 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:mb-2 [&_[cmdk-group-heading]]:mt-4 [&_[cmdk-group-heading]]:px-2">
              <Command.Item onSelect={() => { document.documentElement.classList.toggle('dark'); setOpen(false); }} className="flex cursor-pointer items-center rounded-sm px-2 py-2.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"><Settings2 className="mr-2 h-4 w-4" /> Toggle Theme</Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

export default App;