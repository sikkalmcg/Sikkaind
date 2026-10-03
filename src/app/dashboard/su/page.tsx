'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Save, Trash2, ShieldCheck, Layout, Edit, Search, UserCheck, 
  Lock, Eye, EyeOff, Plus, RefreshCw, KeyRound, CheckSquare, Square,
  Building2, Users, AlertCircle, Info, ExternalLink, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  useMongoStore, 
  useCollectionOptimized, 
  useMemoMongo, 
  setDocumentNonBlocking, 
  deleteDocumentNonBlocking 
} from '@/mongodb';
import { collection, doc, serverTimestamp } from '@/lib/mongo-store';
import { cn } from '@/lib/utils';
import { KNOWN_PLANTS, PlantLocation } from '@/lib/geofence';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';

const SHARED_HUB_ID = 'Sikkaind';

export interface PagePermissionDef {
  code: string;
  name: string;
  category: 'Core' | 'Logistics' | 'Master Data' | 'System';
}

export const ALL_PAGE_PERMISSIONS: PagePermissionDef[] = [
  // Core
  { code: 'Dashboard', name: 'Dashboard Overview', category: 'Core' },
  { code: 'SF22', name: 'SF22 Fleet Registry & GPS', category: 'Core' },
  { code: 'WGPS24', name: 'WGPS24 WheelEye Live GPS', category: 'Core' },
  { code: 'TR21', name: 'TR21 Trip Board Control', category: 'Core' },
  { code: 'TR24', name: 'TR24 Track Shipment', category: 'Core' },

  // Logistics & Vehicles
  { code: 'VT01', name: 'VT01 Vehicle Entry', category: 'Logistics' },
  { code: 'VT02', name: 'VT02 Vehicle Edit/Delete', category: 'Logistics' },
  { code: 'VT03', name: 'VT03 Vehicle Display', category: 'Logistics' },
  { code: 'VT04', name: 'VT04 Vehicle Dispatch', category: 'Logistics' },
  { code: 'VT11', name: 'VT11 Freight Cost Report', category: 'Logistics' },
  { code: 'VA01', name: 'VA01 Sales Order Create', category: 'Logistics' },
  { code: 'VA02', name: 'VA02 Sales Order Change', category: 'Logistics' },
  { code: 'VA03', name: 'VA03 Sales Order Display', category: 'Logistics' },
  { code: 'VA04', name: 'VA04 Sales Order Close', category: 'Logistics' },
  { code: 'VK11', name: 'VK11 Freight Rates Create', category: 'Logistics' },
  { code: 'VK12', name: 'VK12 Freight Rates Change', category: 'Logistics' },
  { code: 'VK13', name: 'VK13 Freight Rates Display', category: 'Logistics' },
  { code: 'MK01', name: 'MK01 Forwarding Agent Create', category: 'Logistics' },
  { code: 'MK02', name: 'MK02 Forwarding Agent Change', category: 'Logistics' },
  { code: 'MK03', name: 'MK03 Forwarding Agent Display', category: 'Logistics' },

  // Master Data
  { code: 'OX01', name: 'OX01 Plant Create', category: 'Master Data' },
  { code: 'OX02', name: 'OX02 Plant Change', category: 'Master Data' },
  { code: 'OX03', name: 'OX03 Plant Display', category: 'Master Data' },
  { code: 'FM01', name: 'FM01 Company Master Create', category: 'Master Data' },
  { code: 'FM02', name: 'FM02 Company Master Change', category: 'Master Data' },
  { code: 'FM03', name: 'FM03 Company Master Display', category: 'Master Data' },
  { code: 'XK01', name: 'XK01 Vendor Master Create', category: 'Master Data' },
  { code: 'XK02', name: 'XK02 Vendor Master Change', category: 'Master Data' },
  { code: 'XK03', name: 'XK03 Vendor Master Display', category: 'Master Data' },
  { code: 'XD01', name: 'XD01 Customer Master Create', category: 'Master Data' },
  { code: 'XD02', name: 'XD02 Customer Master Change', category: 'Master Data' },
  { code: 'XD03', name: 'XD03 Customer Master Display', category: 'Master Data' },

  // System
  { code: 'SU01', name: 'SU01 User Create', category: 'System' },
  { code: 'SU02', name: 'SU02 User Management / Edit Access', category: 'System' },
  { code: 'SU03', name: 'SU03 User Access Details', category: 'System' },
  { code: 'SE38', name: 'SE38 Custom Reports', category: 'System' },
  { code: 'ZCODE', name: 'ZCODE System T-Code Map', category: 'System' },
];

export default function SUPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useMongoStore();

  const queryTCode = searchParams.get('tcode');
  const [activeTab, setActiveTab] = React.useState<'SU02' | 'SU03' | 'SU01'>('SU02');

  React.useEffect(() => {
    if (queryTCode === 'SU03') setActiveTab('SU03');
    else if (queryTCode === 'SU01') setActiveTab('SU01');
    else setActiveTab('SU02');
  }, [queryTCode]);

  // Queries
  const usersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'users_master'), [db]);
  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);

  const { data: dbUsers, isLoading: isUsersLoading } = useCollectionOptimized<any>(usersQuery);
  const { data: dbPlants } = useCollectionOptimized<any>(plantsQuery);

  // Available plants list (combining KNOWN_PLANTS + dbPlants)
  const availablePlants: PlantLocation[] = React.useMemo(() => {
    const list: PlantLocation[] = [...KNOWN_PLANTS];
    (dbPlants || []).forEach((p: any) => {
      const code = p.plantCode || p.id;
      const name = p.plantName || p.name || code;
      if (code && !list.some(item => item.plantCode === code || item.plantName.toLowerCase() === name.toLowerCase())) {
        list.push({
          plantCode: code,
          plantName: name,
          latitude: typeof p.latitude === 'number' ? p.latitude : 0,
          longitude: typeof p.longitude === 'number' ? p.longitude : 0,
          radiusMeters: 500,
        });
      }
    });
    return list;
  }, [dbPlants]);

  // Filter & Search state
  const [searchTerm, setSearchTerm] = React.useState('');

  // Edit User Modal State (for SU02)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<any>(null);
  const [editFormData, setEditFormData] = React.useState({
    fullName: '',
    username: '',
    newPassword: '',
    role: 'User',
    activeStatus: 'Active',
    assignedPages: [] as string[],
    assignedPlants: [] as string[],
  });
  const [showPasswordInput, setShowPasswordInput] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [bannerMsg, setBannerMsg] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Create User Form State (for SU01)
  const [createFormData, setCreateFormData] = React.useState({
    fullName: '',
    username: '',
    password: '',
    role: 'User',
    activeStatus: 'Active',
    assignedPages: ['Dashboard', 'SF22', 'WGPS24', 'TR21'],
    assignedPlants: ['Salt Plant', 'Tea Plant'],
  });

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setBannerMsg({ text, type });
    setTimeout(() => setBannerMsg(null), 4000);
  };

  // Helper to resolve readable plant name from stored code or string
  const formatPlantDisplay = React.useCallback((plantVal: string) => {
    if (!plantVal) return '';
    const norm = String(plantVal).trim().toLowerCase();
    const match = availablePlants.find(
      p => p.plantCode?.toLowerCase() === norm || p.plantName.toLowerCase() === norm
    );
    return match ? match.plantName : plantVal;
  }, [availablePlants]);

  // Helper to resolve readable page name from stored code
  const formatPageDisplay = React.useCallback((pageCode: string) => {
    if (!pageCode) return '';
    const match = ALL_PAGE_PERMISSIONS.find(p => p.code.toUpperCase() === pageCode.toUpperCase());
    return match ? match.code : pageCode;
  }, []);

  // Filtered Users
  const filteredUsers = React.useMemo(() => {
    const list = dbUsers || [];
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();
    return list.filter((u: any) => {
      const name = (u.employeeName || u.fullName || u.name || '').toLowerCase();
      const uname = (u.username || '').toLowerCase();
      const pages = (u.tcodeAccess || u.assignedPages || []).join(' ').toLowerCase();
      const plants = (u.plantAccess || u.assignedPlants || []).join(' ').toLowerCase();
      return name.includes(q) || uname.includes(q) || pages.includes(q) || plants.includes(q);
    });
  }, [dbUsers, searchTerm]);

  // Open Edit Modal for SU02
  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    const existingPages: string[] = user.tcodeAccess || user.assignedPages || [];
    const existingPlants: string[] = user.plantAccess || user.assignedPlants || [];

    setEditFormData({
      fullName: user.employeeName || user.fullName || user.name || '',
      username: user.username || '',
      newPassword: '', // Never pre-fill existing password
      role: user.role || 'User',
      activeStatus: user.activeStatus || 'Active',
      assignedPages: [...existingPages],
      assignedPlants: [...existingPlants],
    });
    setShowPasswordInput(false);
    setIsEditModalOpen(true);
  };

  // Toggle page permission in edit form
  const toggleEditPage = (pageCode: string) => {
    setEditFormData(prev => {
      const exists = prev.assignedPages.some(p => p.toUpperCase() === pageCode.toUpperCase());
      const nextPages = exists
        ? prev.assignedPages.filter(p => p.toUpperCase() !== pageCode.toUpperCase())
        : [...prev.assignedPages, pageCode];
      return { ...prev, assignedPages: nextPages };
    });
  };

  // Toggle plant permission in edit form
  const toggleEditPlant = (plantIdentifier: string) => {
    setEditFormData(prev => {
      const norm = plantIdentifier.toLowerCase();
      const exists = prev.assignedPlants.some(p => p.toLowerCase() === norm);
      const nextPlants = exists
        ? prev.assignedPlants.filter(p => p.toLowerCase() !== norm)
        : [...prev.assignedPlants, plantIdentifier];
      return { ...prev, assignedPlants: nextPlants };
    });
  };

  // Select / Deselect All Pages
  const handleSelectAllPages = (selectAll: boolean) => {
    setEditFormData(prev => ({
      ...prev,
      assignedPages: selectAll ? ALL_PAGE_PERMISSIONS.map(p => p.code) : []
    }));
  };

  // Select / Deselect All Plants
  const handleSelectAllPlants = (selectAll: boolean) => {
    setEditFormData(prev => ({
      ...prev,
      assignedPlants: selectAll ? availablePlants.map(p => p.plantName) : []
    }));
  };

  // Save Edited User Access in SU02
  const handleSaveEditUser = async () => {
    if (!editingUser) return;
    if (!editFormData.username.trim()) {
      alert('Username cannot be blank.');
      return;
    }
    if (!editFormData.fullName.trim()) {
      alert('Full Name cannot be blank.');
      return;
    }

    setIsSaving(true);
    try {
      const docId = editingUser.id || editingUser.uid;
      const userRef = doc(db, 'users', SHARED_HUB_ID, 'users_master', docId);

      const updates: any = {
        username: editFormData.username.trim(),
        employeeName: editFormData.fullName.trim(),
        fullName: editFormData.fullName.trim(),
        role: editFormData.role,
        activeStatus: editFormData.activeStatus,
        tcodeAccess: editFormData.assignedPages,
        assignedPages: editFormData.assignedPages,
        plantAccess: editFormData.assignedPlants,
        assignedPlants: editFormData.assignedPlants,
        updatedAt: serverTimestamp(),
        updatedBy: 'Admin_SU02',
      };

      // Only update password if admin entered a new password
      if (editFormData.newPassword.trim()) {
        updates.password = editFormData.newPassword.trim();
        updates.passwordEncrypted = editFormData.newPassword.trim();
      }

      await setDocumentNonBlocking(userRef, updates, { merge: true });

      showNotification(`User "${editFormData.username}" permissions updated successfully. Updated access is now active.`);
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error('Failed to update user:', err);
      alert(`Update failed: ${err.message || 'System error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete user from SU02
  const handleDeleteUser = (user: any) => {
    const uname = user.username || user.employeeName || 'user';
    if (!confirm(`Are you sure you want to permanently delete user "${uname}"?`)) {
      return;
    }
    const docId = user.id || user.uid;
    deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'users_master', docId));
    showNotification(`User "${uname}" removed from the system.`, 'error');
  };

  // Save New User (SU01)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.username.trim() || !createFormData.password.trim() || !createFormData.fullName.trim()) {
      alert('Full Name, Username, and Password are required.');
      return;
    }

    // Check duplicate username
    if (dbUsers?.some((u: any) => u.username?.toLowerCase() === createFormData.username.trim().toLowerCase())) {
      alert(`User with username "${createFormData.username}" already exists.`);
      return;
    }

    setIsSaving(true);
    try {
      const docId = crypto.randomUUID();
      const userRef = doc(db, 'users', SHARED_HUB_ID, 'users_master', docId);

      const payload = {
        id: docId,
        uid: docId,
        username: createFormData.username.trim(),
        password: createFormData.password.trim(),
        employeeName: createFormData.fullName.trim(),
        fullName: createFormData.fullName.trim(),
        role: createFormData.role,
        activeStatus: createFormData.activeStatus,
        tcodeAccess: createFormData.assignedPages,
        assignedPages: createFormData.assignedPages,
        plantAccess: createFormData.assignedPlants,
        assignedPlants: createFormData.assignedPlants,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'Admin_SU01',
      };

      await setDocumentNonBlocking(userRef, payload, { merge: true });
      showNotification(`User "${createFormData.username}" created successfully.`);
      setCreateFormData({
        fullName: '',
        username: '',
        password: '',
        role: 'User',
        activeStatus: 'Active',
        assignedPages: ['Dashboard', 'SF22', 'WGPS24', 'TR21'],
        assignedPlants: ['Salt Plant', 'Tea Plant'],
      });
      setActiveTab('SU02');
    } catch (err: any) {
      alert(`Failed to create user: ${err.message || 'System error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f4f6f9] font-sans text-slate-900 min-h-screen">
      {/* Top Banner Message */}
      {bannerMsg && (
        <div className={cn(
          "px-8 py-3 text-xs font-bold flex items-center justify-between border-b shadow-sm transition-all animate-fade-in",
          bannerMsg.type === 'success' ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
        )}>
          <div className="flex items-center gap-2">
            {bannerMsg.type === 'success' ? <UserCheck className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
            <span>{bannerMsg.text}</span>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
              User Access & Authorization Management
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              SU01 Create / SU02 Edit Access / SU03 View Details Matrix
            </p>
          </div>
        </div>

        {/* T-Code Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('SU02')}
            className={cn(
              "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'SU02'
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            )}
          >
            <Edit className="h-3.5 w-3.5" />
            <span>SU02: Edit User Access</span>
          </button>

          <button
            onClick={() => setActiveTab('SU03')}
            className={cn(
              "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'SU03'
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>SU03: User Access Details</span>
          </button>

          <button
            onClick={() => setActiveTab('SU01')}
            className={cn(
              "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'SU01'
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>SU01: Create User</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">

        {/* ------------------------------------------------------------- */}
        {/* SU02 TAB: USER MANAGEMENT / EDIT USER ACCESS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'SU02' && (
          <div className="space-y-5 animate-fade-in">
            {/* Action Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by full name, username, plant or page..."
                  className="h-10 pl-10 pr-4 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Users: <strong className="text-blue-600 font-black">{filteredUsers.length}</strong>
                </span>
                <Button
                  onClick={() => setActiveTab('SU01')}
                  className="h-9 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Add New User
                </Button>
              </div>
            </div>

            {/* SU02 Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  SU02 – User Directory & Admin Access Control
                </h3>
                <span className="text-[11px] text-slate-500">
                  Select <strong>&quot;Edit&quot;</strong> to modify Username, Password, Assigned Pages, or Plant Access
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-6">Full Name</th>
                      <th className="py-3 px-4">Username</th>
                      <th className="py-3 px-4">Password</th>
                      <th className="py-3 px-4">Access Pages</th>
                      <th className="py-3 px-4">Access Plant</th>
                      <th className="py-3 px-6 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user: any) => {
                      const fullName = user.employeeName || user.fullName || user.name || 'Unnamed';
                      const username = user.username || '-';
                      const pages: string[] = user.tcodeAccess || user.assignedPages || [];
                      const plants: string[] = user.plantAccess || user.assignedPlants || [];

                      return (
                        <tr key={user.id || user.uid} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center">
                                {fullName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900">{fullName}</div>
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.2 rounded uppercase",
                                  user.activeStatus === 'Active' ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                                )}>
                                  {user.activeStatus || 'Active'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {username}
                          </td>

                          {/* Password Column - Masked, never exposed in plain text */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono text-[11px]">
                              <Lock className="h-3 w-3 text-slate-400" />
                              <span>••••••••</span>
                            </div>
                          </td>

                          {/* Access Pages */}
                          <td className="py-4 px-4 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {pages.length > 0 ? (
                                pages.slice(0, 5).map((page, idx) => (
                                  <span key={idx} className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                                    {formatPageDisplay(page)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No pages assigned</span>
                              )}
                              {pages.length > 5 && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 rounded">
                                  +{pages.length - 5} more
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Access Plant */}
                          <td className="py-4 px-4 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {plants.length > 0 ? (
                                plants.map((plant, idx) => (
                                  <span key={idx} className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded flex items-center gap-1">
                                    <Building2 className="h-2.5 w-2.5" />
                                    {formatPlantDisplay(plant)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-red-500 font-medium italic">No plant access</span>
                              )}
                            </div>
                          </td>

                          {/* Action Button: Edit */}
                          <td className="py-4 px-6 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                onClick={() => handleOpenEdit(user)}
                                className="h-8 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Edit className="h-3 w-3" /> Edit Access
                              </Button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                title="Delete User"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="font-bold text-xs">No users matching search query.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SU03 TAB: USER ACCESS DETAILS (VIEW / INFORMATION SCREEN)     */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'SU03' && (
          <div className="space-y-5 animate-fade-in">
            {/* Info notice explaining SU03 role */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-xs">
              <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong className="font-black uppercase tracking-wide">SU03 – User Access Details (Display Screen)</strong>
                <p className="mt-0.5 text-amber-800">
                  This screen displays all created users along with their currently assigned page and plant access permissions.
                  This is a read-only audit screen. To modify user credentials or permissions, switch to <strong>SU02 (Edit User Access)</strong>.
                </p>
                <div className="mt-2">
                  <Button
                    onClick={() => setActiveTab('SU02')}
                    variant="outline"
                    className="h-7 px-3 text-[11px] font-bold border-amber-300 text-amber-900 bg-white hover:bg-amber-100 flex items-center gap-1.5"
                  >
                    <Edit className="h-3 w-3" /> Switch to SU02 to Edit Permissions
                  </Button>
                </div>
              </div>
            </div>

            {/* Filter Search */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter users or assigned plants..."
                  className="h-10 pl-10 pr-4 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Displaying: <strong className="text-slate-800 font-black">{filteredUsers.length} Users</strong>
              </span>
            </div>

            {/* SU03 Table matching the user's exact specification */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase text-[11px] tracking-wider">
                    <th className="py-3.5 px-6">Full Name</th>
                    <th className="py-3.5 px-6">Username</th>
                    <th className="py-3.5 px-6">Access Pages</th>
                    <th className="py-3.5 px-6">Access Plant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user: any) => {
                    const fullName = user.employeeName || user.fullName || user.name || 'Unnamed';
                    const username = user.username || '-';
                    const pages: string[] = user.tcodeAccess || user.assignedPages || [];
                    const plants: string[] = user.plantAccess || user.assignedPlants || [];

                    const readablePages = pages.length > 0 
                      ? pages.map(p => formatPageDisplay(p)).join(', ')
                      : 'None';

                    const readablePlants = plants.length > 0
                      ? plants.map(p => formatPlantDisplay(p)).join(', ')
                      : 'None';

                    return (
                      <tr key={user.id || user.uid} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-900 whitespace-nowrap">
                          {fullName}
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {username}
                        </td>
                        <td className="py-4 px-6 text-slate-800 font-medium">
                          {readablePages}
                        </td>
                        <td className="py-4 px-6 text-emerald-800 font-bold whitespace-nowrap">
                          {readablePlants}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="font-bold text-xs">No user access records found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SU01 TAB: CREATE USER                                         */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'SU01' && (
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm max-w-3xl mx-auto space-y-6 animate-fade-in">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600" />
                SU01 – Create New User Profile
              </h2>
              <p className="text-xs text-slate-500">
                Register a new user and assign initial page and plant permissions.
              </p>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={createFormData.fullName}
                    onChange={(e) => setCreateFormData({ ...createFormData, fullName: e.target.value })}
                    placeholder="e.g. Ajay Somra"
                    className="h-10 px-3 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Username *</label>
                  <input
                    type="text"
                    required
                    value={createFormData.username}
                    onChange={(e) => setCreateFormData({ ...createFormData, username: e.target.value })}
                    placeholder="e.g. ajay"
                    className="h-10 px-3 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Password *</label>
                  <input
                    type="password"
                    required
                    value={createFormData.password}
                    onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                    placeholder="Set user password"
                    className="h-10 px-3 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Role</label>
                  <select
                    value={createFormData.role}
                    onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value })}
                    className="h-10 px-3 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="Admin">System Admin</option>
                    <option value="Manager">Logistics Manager</option>
                    <option value="User">Standard User</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab('SU02')}
                  className="h-10 px-5 text-xs font-bold rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="h-10 px-6 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                >
                  {isSaving ? 'Creating...' : 'Create User & Open SU02'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ADMIN EDIT USER ACCESS MODAL (SU02)                           */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
              <Edit className="h-4 w-4 text-blue-600" />
              SU02 – Edit User Access & Permissions
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Modify credentials, assigned system pages, and plant authorizations for this account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-3">
            {/* User Core Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-600">Full Name</label>
                <input
                  type="text"
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  className="h-9 px-3 w-full bg-white border border-slate-300 rounded-md text-xs font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-600">Username</label>
                <input
                  type="text"
                  value={editFormData.username}
                  onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                  className="h-9 px-3 w-full bg-white border border-slate-300 rounded-md text-xs font-bold font-mono outline-none focus:border-blue-500"
                />
              </div>

              {/* Password Change Field */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-bold uppercase text-slate-600 flex items-center justify-between">
                  <span>Change Password</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (Leave blank to keep existing password unchanged)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showPasswordInput ? "text" : "password"}
                    value={editFormData.newPassword}
                    onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                    placeholder="Enter new password to update (or leave blank)..."
                    className="h-9 pl-3 pr-10 w-full bg-white border border-slate-300 rounded-md text-xs font-mono outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordInput(!showPasswordInput)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswordInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-600">Role</label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  className="h-9 px-3 w-full bg-white border border-slate-300 rounded-md text-xs font-medium outline-none focus:border-blue-500"
                >
                  <option value="Admin">System Admin</option>
                  <option value="Manager">Logistics Manager</option>
                  <option value="User">Standard User</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-600">Status</label>
                <select
                  value={editFormData.activeStatus}
                  onChange={(e) => setEditFormData({ ...editFormData, activeStatus: e.target.value })}
                  className="h-9 px-3 w-full bg-white border border-slate-300 rounded-md text-xs font-medium outline-none focus:border-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Plant Authorization Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                    Access Plant Authorization
                  </h4>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    {editFormData.assignedPlants.length} Assigned
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAllPlants(true)}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    Assign All Plants
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAllPlants(false)}
                    className="text-[10px] font-bold text-red-600 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Rule: If a user does not have access to a particular plant, the user cannot view, edit, approve, or manage data for that plant.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {availablePlants.map((plant) => {
                  const pName = plant.plantName;
                  const isChecked = editFormData.assignedPlants.some(
                    p => p.toLowerCase() === pName.toLowerCase() || p.toLowerCase() === (plant.plantCode || '').toLowerCase()
                  );

                  return (
                    <button
                      key={plant.plantCode || plant.plantName}
                      type="button"
                      onClick={() => toggleEditPlant(plant.plantName)}
                      className={cn(
                        "p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer",
                        isChecked
                          ? "bg-emerald-50/70 border-emerald-500 text-emerald-950 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                    >
                      <div className="mt-0.5">
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-300" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-tight">{plant.plantName}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">Code: {plant.plantCode}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Page Permissions Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Layout className="h-4 w-4 text-blue-600" />
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                    Access Pages Authorization
                  </h4>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    {editFormData.assignedPages.length} Pages Allowed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAllPages(true)}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAllPages(false)}
                    className="text-[10px] font-bold text-red-600 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {ALL_PAGE_PERMISSIONS.map((page) => {
                  const isChecked = editFormData.assignedPages.some(
                    p => p.toUpperCase() === page.code.toUpperCase()
                  );

                  return (
                    <button
                      key={page.code}
                      type="button"
                      onClick={() => toggleEditPage(page.code)}
                      className={cn(
                        "p-2.5 rounded-lg border text-left flex items-start gap-2 transition-all cursor-pointer",
                        isChecked
                          ? "bg-blue-50 border-blue-500 text-blue-950 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isChecked ? (
                          <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black leading-tight truncate">{page.code}</div>
                        <div className="text-[9px] text-slate-500 leading-tight truncate">{page.name}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 pt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="h-9 px-4 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={handleSaveEditUser}
              className="h-9 px-6 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving Changes...' : 'Save Permissions'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}