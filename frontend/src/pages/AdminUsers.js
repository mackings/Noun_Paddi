import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import {
  Search,
  Users,
  Mail,
  User,
  MapPin,
  BookOpen,
  Calendar,
  Hash,
  Shield,
  Loader2,
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || 'U') + (parts[1]?.[0] || '');
};

const getUserLocation = (user = {}) => {
  const profile = user || {};
  return profile.location || profile.city || profile.state || profile.country || profile.studyCenter || '';
};

const selectClass = 'tw:h-10 tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [error, setError] = useState('');
  const [inviteForm, setInviteForm] = useState({ name: '', email: '' });
  const [inviteStatus, setInviteStatus] = useState({ type: '', text: '' });

  const fetchUsers = useCallback(async (query = '') => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/users${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      const data = response.data.data || [];
      setUsers(data);
      if (data[0]) {
        setSelectedUser(data[0]);
      } else {
        setSelectedUser(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = () => {
    fetchUsers(searchTerm.trim());
  };

  const handleSearchInput = (event) => {
    setSearchTerm(event.target.value);
    if (!event.target.value) {
      fetchUsers('');
    }
  };

  const handleInvite = async (event) => {
    event.preventDefault();
    setInviteStatus({ type: '', text: '' });
    try {
      await api.post('/admin/invite', inviteForm);
      setInviteStatus({ type: 'success', text: 'Invite sent successfully.' });
      setInviteForm({ name: '', email: '' });
    } catch (err) {
      setInviteStatus({
        type: 'error',
        text: err.response?.data?.message || 'Failed to send invite.',
      });
    }
  };

  const selectedProfile = useMemo(() => selectedUser, [selectedUser]);
  const selectedLocation = getUserLocation(selectedProfile);
  const locationOptions = useMemo(() => {
    return Array.from(new Set(users.map((user) => getUserLocation(user)).filter(Boolean))).sort();
  }, [users]);
  const visibleUsers = useMemo(() => {
    if (!locationFilter) return users;
    return users.filter((user) => getUserLocation(user) === locationFilter);
  }, [locationFilter, users]);

  return (
    <div className="tw:space-y-5">
      <Card className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-4 tw:p-5">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Admin Control</p>
          <h1 className="tw:font-heading tw:text-xl tw:font-bold tw:tracking-tight">Users & Profiles</h1>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Monitor profile photos, roles, locations, and enrollment details in one place.</p>
        </div>
        <div className="tw:flex tw:items-center tw:gap-3 tw:rounded-2xl tw:bg-brand-600 tw:px-4 tw:py-3 tw:text-white">
          <Users className="tw:h-5 tw:w-5" />
          <div>
            <span className="tw:block tw:text-xs tw:text-brand-100">Total Users</span>
            <strong className="tw:font-heading tw:text-lg tw:font-bold">{users.length}</strong>
          </div>
        </div>
      </Card>

      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <div className="tw:relative tw:min-w-[240px] tw:flex-1">
          <Search className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:h-4 tw:w-4 tw:-translate-y-1/2 tw:text-slate-400" />
          <Input
            type="text"
            placeholder="Search by name, email, faculty, department, study center, or matric number"
            value={searchTerm}
            onChange={handleSearchInput}
            className="tw:pl-9"
          />
        </div>
        <Button onClick={handleSearch}>Search</Button>
        <select
          className={selectClass}
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
          aria-label="Filter users by location"
        >
          <option value="">All locations</option>
          {locationOptions.map((location) => (
            <option key={location} value={location}>{location}</option>
          ))}
        </select>
      </div>

      <Card id="invite" className="tw:flex tw:flex-col tw:gap-4 tw:p-5 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Invite admin</p>
          <h2 className="tw:font-heading tw:text-base tw:font-bold">Add a new admin</h2>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Send a temporary password to a trusted teammate. They can update it after login.</p>
        </div>
        <form onSubmit={handleInvite} className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <Input
            type="text"
            placeholder="Full name"
            value={inviteForm.name}
            onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })}
            required
            className="tw:w-44"
          />
          <Input
            type="email"
            placeholder="Email address"
            value={inviteForm.email}
            onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })}
            required
            className="tw:w-56"
          />
          <Button type="submit">Send Invite</Button>
        </form>
        {inviteStatus.text && (
          <div className={cn(
            'tw:rounded-xl tw:px-3.5 tw:py-2 tw:text-xs tw:font-semibold',
            inviteStatus.type === 'success'
              ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
              : 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
          )}>
            {inviteStatus.text}
          </div>
        )}
      </Card>

      {error && (
        <div className="tw:rounded-xl tw:bg-red-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
          <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
          <p className="tw:text-sm">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
          <Users className="tw:h-10 tw:w-10 tw:text-slate-300" />
          <h3 className="tw:font-heading tw:text-sm tw:font-bold">No users found</h3>
          <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Try another search or clear the filters.</p>
        </Card>
      ) : visibleUsers.length === 0 ? (
        <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
          <MapPin className="tw:h-10 tw:w-10 tw:text-slate-300" />
          <h3 className="tw:font-heading tw:text-sm tw:font-bold">No users in this location</h3>
          <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Choose another location or clear the filter.</p>
        </Card>
      ) : (
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-[360px_1fr]">
          <div className="tw:max-h-[70vh] tw:space-y-2 tw:overflow-y-auto tw:pr-1">
            {visibleUsers.map((user) => (
              <button
                key={user._id}
                onClick={() => setSelectedUser(user)}
                className={cn(
                  'tw:flex tw:w-full tw:items-center tw:gap-3 tw:rounded-2xl tw:border tw:p-3 tw:text-left tw:transition-colors',
                  selectedUser?._id === user._id
                    ? 'tw:border-brand-600 tw:bg-brand-50 tw:dark:bg-brand-950'
                    : 'tw:border-slate-200/70 tw:bg-white tw:dark:border-slate-800 tw:dark:bg-slate-900',
                )}
              >
                <div className="tw:flex tw:h-11 tw:w-11 tw:shrink-0 tw:items-center tw:justify-center tw:overflow-hidden tw:rounded-full tw:bg-brand-100 tw:text-sm tw:font-bold tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} className="tw:h-full tw:w-full tw:object-cover" />
                  ) : (
                    <span>{getInitials(user.name)}</span>
                  )}
                </div>
                <div className="tw:min-w-0">
                  <h4 className="tw:truncate tw:text-sm tw:font-bold">{user.name}</h4>
                  <span className="tw:flex tw:items-center tw:gap-1 tw:truncate tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                    <Mail className="tw:h-3 tw:w-3 tw:shrink-0" /> {user.email}
                  </span>
                  <div className="tw:mt-1 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-[11px] tw:text-slate-400">
                    <span className="tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300">{user.role}</span>
                    <span className="tw:flex tw:items-center tw:gap-0.5"><MapPin className="tw:h-3 tw:w-3" /> {getUserLocation(user) || 'No location'}</span>
                    {user.matricNumber && <span>{user.matricNumber}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <Card className="tw:p-5">
            {selectedProfile ? (
              <div className="tw:space-y-5">
                <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-4">
                  <div className="tw:flex tw:h-16 tw:w-16 tw:shrink-0 tw:items-center tw:justify-center tw:overflow-hidden tw:rounded-full tw:bg-brand-100 tw:text-xl tw:font-bold tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                    {selectedProfile.profileImage ? (
                      <img src={selectedProfile.profileImage} alt={selectedProfile.name} className="tw:h-full tw:w-full tw:object-cover" />
                    ) : (
                      <span>{getInitials(selectedProfile.name)}</span>
                    )}
                  </div>
                  <div>
                    <h2 className="tw:font-heading tw:text-lg tw:font-bold">{selectedProfile.name}</h2>
                    <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">{selectedProfile.email}</p>
                    <div className="tw:mt-2 tw:flex tw:flex-wrap tw:gap-2">
                      <span className="tw:flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-brand-100 tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300"><Shield className="tw:h-3 tw:w-3" /> {selectedProfile.role}</span>
                      <span className="tw:flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300"><MapPin className="tw:h-3 tw:w-3" /> {selectedLocation || 'No location'}</span>
                    </div>
                  </div>
                </div>

                {selectedProfile.profileImage && (
                  <div className="tw:flex tw:items-center tw:gap-3 tw:rounded-2xl tw:border tw:border-slate-200/70 tw:p-3 tw:dark:border-slate-800">
                    <img src={selectedProfile.profileImage} alt={`${selectedProfile.name} profile`} className="tw:h-14 tw:w-14 tw:rounded-xl tw:object-cover" />
                    <div>
                      <h4 className="tw:text-sm tw:font-bold">User Picture</h4>
                      <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Uploaded profile image is available and shown across the admin user view.</p>
                    </div>
                  </div>
                )}

                <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2">
                  <div className="tw:space-y-2">
                    <h4 className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-slate-400 tw:uppercase">Profile Details</h4>
                    <ul className="tw:space-y-1.5 tw:text-sm">
                      <li className="tw:flex tw:items-center tw:gap-1.5"><BookOpen className="tw:h-3.5 tw:w-3.5 tw:text-slate-400" /> Faculty: {selectedProfile.faculty || 'N/A'}</li>
                      <li className="tw:flex tw:items-center tw:gap-1.5"><BookOpen className="tw:h-3.5 tw:w-3.5 tw:text-slate-400" /> Department: {selectedProfile.department || 'N/A'}</li>
                      <li className="tw:flex tw:items-center tw:gap-1.5"><MapPin className="tw:h-3.5 tw:w-3.5 tw:text-slate-400" /> Study Center: {selectedProfile.studyCenter || 'N/A'}</li>
                      <li className="tw:flex tw:items-center tw:gap-1.5"><MapPin className="tw:h-3.5 tw:w-3.5 tw:text-slate-400" /> Location: {selectedLocation || 'N/A'}</li>
                      <li className="tw:flex tw:items-center tw:gap-1.5"><Hash className="tw:h-3.5 tw:w-3.5 tw:text-slate-400" /> Matric Number: {selectedProfile.matricNumber || 'N/A'}</li>
                    </ul>
                  </div>
                  <div className="tw:space-y-2">
                    <h4 className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-slate-400 tw:uppercase">Account</h4>
                    <ul className="tw:space-y-1.5 tw:text-sm">
                      <li className="tw:flex tw:items-center tw:gap-1.5"><Calendar className="tw:h-3.5 tw:w-3.5 tw:text-slate-400" /> Joined: {formatDate(selectedProfile.createdAt)}</li>
                      <li className="tw:flex tw:items-center tw:gap-1.5"><Mail className="tw:h-3.5 tw:w-3.5 tw:text-slate-400" /> Email: {selectedProfile.email}</li>
                      <li className="tw:flex tw:items-center tw:gap-1.5"><User className="tw:h-3.5 tw:w-3.5 tw:text-slate-400" /> User ID: {selectedProfile._id}</li>
                      <li className="tw:flex tw:items-center tw:gap-1.5"><Shield className="tw:h-3.5 tw:w-3.5 tw:text-slate-400" /> Status: Active</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h4 className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-slate-400 tw:uppercase">Bio</h4>
                  <p className="tw:mt-1.5 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">{selectedProfile.bio || 'No bio has been added by this user.'}</p>
                </div>
              </div>
            ) : (
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
                <Users className="tw:h-10 tw:w-10 tw:text-slate-300" />
                <h3 className="tw:font-heading tw:text-sm tw:font-bold">Select a user</h3>
                <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Choose a user from the list to view profile details.</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
