import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import {
  FiSearch,
  FiUsers,
  FiMail,
  FiUser,
  FiMapPin,
  FiBookOpen,
} from 'react-icons/fi';
import './AdminUsers.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (query = '') => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/users${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      const data = response.data.data || [];
      setUsers(data);
      setSelectedUser(data[0] || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchUsers(searchTerm.trim());
  };

  const handleSearchInput = (event) => {
    setSearchTerm(event.target.value);
    if (!event.target.value) {
      fetchUsers('');
    }
  };

  const selectedProfile = useMemo(() => selectedUser, [selectedUser]);

  return (
    <div className="admin-users-container">
      <div className="container">
        <div className="admin-users-hero">
          <div>
            <p className="admin-users-kicker">Admin Control</p>
            <h1>Users & Profiles</h1>
            <p>Monitor user profiles, roles, and enrollment details in one place.</p>
          </div>
          <div className="admin-users-stat">
            <FiUsers />
            <div>
              <span>Total Users</span>
              <strong>{users.length}</strong>
            </div>
          </div>
        </div>

        <div className="admin-users-toolbar">
          <div className="admin-users-search">
            <FiSearch />
            <input
              type="text"
              placeholder="Search by name, email, faculty, or matric number"
              value={searchTerm}
              onChange={handleSearchInput}
            />
          </div>
          <button className="btn btn-primary" onClick={handleSearch}>
            Search
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {loading ? (
          <div className="admin-users-loading">
            <div className="user-skeleton-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="user-skeleton-card">
                  <div className="skeleton-avatar"></div>
                  <div className="skeleton-line wide"></div>
                  <div className="skeleton-line"></div>
                </div>
              ))}
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="admin-users-empty">
            <FiUsers size={56} />
            <h3>No users found</h3>
            <p>Try another search or clear the filters.</p>
          </div>
        ) : (
          <div className="admin-users-grid">
            <div className="admin-users-list">
              {users.map((user) => (
                <button
                  key={user._id}
                  className={`user-card ${selectedUser?._id === user._id ? 'active' : ''}`}
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="user-avatar">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt={user.name} />
                    ) : (
                      <FiUser />
                    )}
                  </div>
                  <div className="user-info">
                    <h4>{user.name}</h4>
                    <span className="user-email">
                      <FiMail /> {user.email}
                    </span>
                    <div className="user-meta">
                      <span>{user.role}</span>
                      {user.matricNumber && <span>{user.matricNumber}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="admin-user-profile">
              {selectedProfile ? (
                <>
                  <div className="profile-header">
                    <div className="profile-avatar-large">
                      {selectedProfile.profileImage ? (
                        <img src={selectedProfile.profileImage} alt={selectedProfile.name} />
                      ) : (
                        <FiUser />
                      )}
                    </div>
                    <div>
                      <h2>{selectedProfile.name}</h2>
                      <p>{selectedProfile.email}</p>
                      <span className="role-chip">{selectedProfile.role}</span>
                    </div>
                  </div>

                  <div className="profile-details">
                    <div>
                      <h4>Profile Details</h4>
                      <ul>
                        <li><FiBookOpen /> Faculty: {selectedProfile.faculty || 'N/A'}</li>
                        <li><FiMapPin /> Department: {selectedProfile.department || 'N/A'}</li>
                        <li><FiUser /> Matric Number: {selectedProfile.matricNumber || 'N/A'}</li>
                      </ul>
                    </div>
                    <div>
                      <h4>Account</h4>
                      <ul>
                        <li>Joined: {formatDate(selectedProfile.createdAt)}</li>
                        <li>Status: Active</li>
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <div className="admin-users-empty">
                  <FiUsers size={56} />
                  <h3>Select a user</h3>
                  <p>Choose a user from the list to view profile details.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
