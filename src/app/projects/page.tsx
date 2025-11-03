"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";

// Firebase imports
import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  updateProfile, // Import updateProfile
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  setDoc, // Import setDoc for storing password
  deleteDoc,
  Timestamp,
  Firestore,
} from "firebase/firestore";

interface Project {
  id?: string;
  name: string;
  description: string;
  status: "Pending" | "In Progress" | "Completed";
  assignedTo: string; // This should ideally match the employee's display name for filtering
  dueDate: Timestamp;
  creationDate: Timestamp;
  managerAssigned: boolean;
  managerName: string;
  userId: string; // The Firebase UID of the user who created/owns the project
}

// Global variables provided by the Canvas environment
declare const __app_id: string;
declare const __firebase_config: string;
declare const __initial_auth_token: string;

// Fallback Firebase config for local development if global variables are not defined
const firebaseConfigForLocal = {
  apiKey: "AIzaSyD0LZtuBO-DP3c0JvvB-ohrsbjyUGDQ8wU",
  authDomain: "compy-ed868.firebaseapp.com",
  projectId: "compy-ed868",
  storageBucket: "compy-ed868.appspot.com",
  messagingSenderId: "278905766725",
  appId: "1:278905766725:web:5d32da09897a70c874742c",
  measurementId: "G-KGTF3MWNWN",
};

// Custom Confirmation Modal Component
const ConfirmationModal = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[999]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm text-center"
        initial={{ scale: 0.9, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <p className="text-lg font-semibold text-gray-800 mb-6">{message}</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition"
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg shadow hover:bg-gray-400 transition"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function ProjectsDashboard() {
  const [app, setApp] = useState<FirebaseApp | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null); // New state for username
  const [userRole, setUserRole] = useState<"employee" | "manager">("employee"); // Default to employee
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStatus, setProjectStatus] =
    useState<Project["status"]>("Pending");
  const [projectAssignedTo, setProjectAssignedTo] = useState("");
  const [projectDueDate, setProjectDueDate] = useState("");
  const [projectManagerAssigned, setProjectManagerAssigned] = useState(false);
  const [projectManagerName, setProjectManagerName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showPastProjects, setShowPastProjects] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [showIntroCalendar, setShowIntroCalendar] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  // New states for manager password protection
  const [managerPasswordInput, setManagerPasswordInput] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [storedManagerPassword, setStoredManagerPassword] = useState<
    string | null
  >(null); // Stored password from Firestore
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false); // For setting new password
  const [newManagerPasswordInput, setNewManagerPasswordInput] = useState(""); // For new password input

  // Effect for Firebase Initialization and Authentication
  useEffect(() => {
    try {
      const configToUse =
        typeof __firebase_config !== "undefined" && __firebase_config !== ""
          ? JSON.parse(__firebase_config)
          : firebaseConfigForLocal;

      const initializedApp = initializeApp(configToUse);
      const initializedAuth = getAuth(initializedApp);
      const initializedDb = getFirestore(initializedApp);

      setApp(initializedApp);
      setAuth(initializedAuth);
      setDb(initializedDb);

      const unsubscribeAuth = onAuthStateChanged(
        initializedAuth,
        async (user) => {
          if (user) {
            setUserId(user.uid);
            // Set userName from displayName, or null if not available
            setUserName(user.displayName || null);
          } else {
            try {
              if (
                typeof __initial_auth_token !== "undefined" &&
                __initial_auth_token !== ""
              ) {
                const customUserCredential = await signInWithCustomToken(
                  initializedAuth,
                  __initial_auth_token
                );
                setUserId(customUserCredential.user.uid);
                setUserName(customUserCredential.user.displayName || null);
              } else {
                const anonUserCredential = await signInAnonymously(
                  initializedAuth
                );
                setUserId(anonUserCredential.user.uid);
                if (!anonUserCredential.user.displayName) {
                  await updateProfile(anonUserCredential.user, {
                    displayName: "Employee",
                  });
                  setUserName("Employee");
                } else {
                  setUserName(anonUserCredential.user.displayName);
                }
              }
            } catch (authError: any) {
              console.error("Firebase Auth error:", authError);
              toast.error(`Authentication failed: ${authError.message}`);
              setError("Authentication failed. Please try logging in again.");
            }
          }
          setIsAuthReady(true);
        }
      );

      return () => {
        unsubscribeAuth();
      };
    } catch (err: any) {
      console.error("Failed to initialize Firebase:", err);
      toast.error(`Firebase initialization error: ${err.message}`);
      setError("Failed to initialize the application.");
    }
  }, []);

  // Effect to hide the intro calendar after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntroCalendar(false);
    }, 3000); // Hide after 3 seconds
    return () => clearTimeout(timer);
  }, []);

  // Effect for fetching projects from Firestore
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;

    setLoading(true);
    setError(null);

    try {
      const appId =
        typeof __app_id !== "undefined" && __app_id !== ""
          ? __app_id
          : firebaseConfigForLocal.projectId;

      const projectsCollectionRef = collection(
        db,
        `artifacts/${appId}/users/${userId}/projects`
      );
      const q = query(projectsCollectionRef);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedProjects: Project[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            fetchedProjects.push({
              id: doc.id,
              name: data.name || "",
              description: data.description || "",
              status: data.status || "Pending",
              assignedTo: data.assignedTo || "",
              dueDate:
                data.dueDate instanceof Timestamp
                  ? data.dueDate
                  : Timestamp.fromDate(new Date()),
              creationDate:
                data.creationDate instanceof Timestamp
                  ? data.creationDate
                  : Timestamp.fromDate(new Date()),
              managerAssigned: data.managerAssigned || false,
              managerName: data.managerName || "",
              userId: data.userId || userId,
            });
          });
          setProjects(fetchedProjects);
          setLoading(false);
        },
        (err) => {
          console.error("Error fetching projects:", err);
          setError("Failed to load projects. Please try again.");
          setLoading(false);
          toast.error("Failed to load projects.");
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.error("Error setting up onSnapshot:", err);
      setError("Failed to set up real-time project listener.");
      setLoading(false);
    }
  }, [db, userId, isAuthReady, firebaseConfigForLocal.projectId]);

  // Effect to fetch manager password from Firestore
  useEffect(() => {
    if (!db || !isAuthReady) return;

    const appId =
      typeof __app_id !== "undefined" && __app_id !== ""
        ? __app_id
        : firebaseConfigForLocal.projectId;
    const managerPasswordDocRef = doc(
      db,
      `artifacts/${appId}/settings/managerPassword`
    );

    const unsubscribe = onSnapshot(
      managerPasswordDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStoredManagerPassword(data.password || null);
        } else {
          setStoredManagerPassword(null); // No password set yet
        }
      },
      (error) => {
        console.error("Error fetching manager password:", error);
        // Removed toast.error here as it's handled by the parent component, to avoid duplicate toasts
      }
    );

    return () => unsubscribe();
  }, [db, isAuthReady, firebaseConfigForLocal.projectId]);

  const handleOpenModal = (project?: Project) => {
    setIsModalOpen(true);
    if (project) {
      setCurrentProject(project);
      setProjectName(project.name);
      setProjectDescription(project.description);
      setProjectStatus(project.status);
      setProjectAssignedTo(project.assignedTo);
      setProjectDueDate(project.dueDate.toDate().toISOString().split("T")[0]);
      setProjectManagerAssigned(project.managerAssigned);
      setProjectManagerName(project.managerName || "");
    } else {
      setCurrentProject(null);
      setProjectName("");
      setProjectDescription("");
      setProjectStatus("Pending");
      setProjectAssignedTo("");
      setProjectDueDate("");
      setProjectManagerAssigned(false);
      setProjectManagerName("");
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSaveProject = async () => {
    if (!db || !userId) {
      toast.error(
        "Database or user not ready. Please refresh or check authentication."
      );
      return;
    }
    if (
      !projectName ||
      !projectDescription ||
      !projectAssignedTo ||
      !projectDueDate ||
      !projectManagerName
    ) {
      toast.error(
        "Please fill all required fields: Project Name, Description, Assigned To, Due Date, and Manager Name."
      );
      return;
    }

    try {
      setLoading(true);
      const projectData: Omit<Project, "id"> = {
        name: projectName,
        description: projectDescription,
        status: projectStatus,
        assignedTo: projectAssignedTo,
        dueDate: Timestamp.fromDate(new Date(projectDueDate)),
        creationDate: currentProject
          ? currentProject.creationDate
          : Timestamp.now(),
        managerAssigned: projectManagerAssigned,
        managerName: projectManagerName,
        userId: userId,
      };

      const appId =
        typeof __app_id !== "undefined" && __app_id !== ""
          ? __app_id
          : firebaseConfigForLocal.projectId;
      const projectsCollectionRef = collection(
        db,
        `artifacts/${appId}/users/${userId}/projects`
      );

      if (currentProject?.id) {
        const projectDocRef = doc(projectsCollectionRef, currentProject.id);
        await updateDoc(projectDocRef, projectData);
        toast.success("Project updated successfully!");
      } else {
        await addDoc(projectsCollectionRef, projectData);
        toast.success("Project added successfully!");
      }
      handleCloseModal();
    } catch (err: any) {
      console.error("Error saving project:", err);
      toast.error(`Failed to save project: ${err.message}`);
      setError(`Failed to save project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (projectId: string) => {
    setProjectToDelete(projectId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!db || !userId || !projectToDelete) {
      toast.error(
        "Database or user not ready, or no project selected for deletion."
      );
      return;
    }

    try {
      setLoading(true);
      const appId =
        typeof __app_id !== "undefined" && __app_id !== ""
          ? __app_id
          : firebaseConfigForLocal.projectId;
      const projectDocRef = doc(
        db,
        `artifacts/${appId}/users/${userId}/projects`,
        projectToDelete
      );
      await deleteDoc(projectDocRef);
      toast.success("Project deleted successfully!");
    } catch (err: any) {
      console.error("Error deleting project:", err);
      toast.error(`Failed to delete project: ${err.message}`);
      setError(`Failed to delete project: ${err.message}`);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      setProjectToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setProjectToDelete(null);
  };

  const handleUpdateStatus = async (
    projectId: string,
    newStatus: Project["status"]
  ) => {
    if (!db || !userId) {
      toast.error(
        "Database or user not ready. Please refresh or check authentication."
      );
      return;
    }
    try {
      setLoading(true);
      const appId =
        typeof __app_id !== "undefined" && __app_id !== ""
          ? __app_id
          : firebaseConfigForLocal.projectId;
      const projectDocRef = doc(
        db,
        `artifacts/${appId}/users/${userId}/projects`,
        projectId
      );
      await updateDoc(projectDocRef, { status: newStatus });
      toast.success("Project status updated!");
    } catch (err: any) {
      console.error("Error updating status:", err);
      toast.error(`Failed to update status: ${err.message}`);
      setError(`Failed to update status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCalendarToggle = () => {
    setShowCalendar(!showCalendar);
    if (!showCalendar) {
      toast("Calendar view is now active. Click on a date to filter projects.");
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setFilterStatus("");
    setSearchTerm("");
    toast.success(`Showing projects due on ${date.toLocaleDateString()}`);
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
    toast.success("Cleared date filter");
  };

  // Function to handle raising a query
  const handleRaiseQuery = (projectName: string) => {
    toast(
      `Query raised for project: "${projectName}"! Your manager will be notified.`
    );
  };

  // Function to handle role change from dropdown
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRole = e.target.value as "employee" | "manager";
    if (selectedRole === "manager") {
      setShowPasswordPrompt(true);
      setManagerPasswordInput(""); // Clear password input when prompt appears
    } else {
      setUserRole("employee");
      setShowPasswordPrompt(false);
    }
  };

  // Function to handle manager login (password check)
  const handleManagerLogin = () => {
    // If no password is set, allow access and prompt to set one
    if (storedManagerPassword === null || storedManagerPassword === "") {
      setUserRole("manager");
      setShowPasswordPrompt(false);
      toast.success(
        "Manager View activated! Please set a password for future access."
      );
      return;
    }

    if (managerPasswordInput === storedManagerPassword) {
      setUserRole("manager");
      setShowPasswordPrompt(false);
      toast.success("Logged in as Manager!");
    } else {
      toast.error("Incorrect password!");
      setManagerPasswordInput(""); // Clear password on incorrect attempt
    }
  };

  // Function to set the manager password
  const handleSetManagerPassword = async () => {
    if (!db) {
      toast.error("Database not ready.");
      return;
    }
    if (!newManagerPasswordInput.trim()) {
      toast.error("Password cannot be empty.");
      return;
    }

    try {
      setLoading(true);
      const appId =
        typeof __app_id !== "undefined" && __app_id !== ""
          ? __app_id
          : firebaseConfigForLocal.projectId;
      const managerPasswordDocRef = doc(
        db,
        `artifacts/${appId}/settings/managerPassword`
      );

      // WARNING: Storing passwords in plain text is INSECURE.
      // In a real application, you would hash and salt this password on a secure backend.
      await setDoc(managerPasswordDocRef, {
        password: newManagerPasswordInput.trim(),
      });
      setStoredManagerPassword(newManagerPasswordInput.trim()); // Update local state
      setShowSetPasswordModal(false);
      setNewManagerPasswordInput("");
      toast.success("Manager password set successfully!");
    } catch (error: any) {
      console.error("Error setting manager password:", error);
      toast.error(`Failed to set password: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      searchTerm === "" ||
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.managerName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "" || project.status === filterStatus;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = project.dueDate.toDate();
    dueDate.setHours(0, 0, 0, 0);

    const isPastProject = dueDate < today;
    const matchesPastProjectFilter = showPastProjects || !isPastProject;

    const matchesDate =
      !selectedDate ||
      (dueDate.getDate() === selectedDate.getDate() &&
        dueDate.getMonth() === selectedDate.getMonth() &&
        dueDate.getFullYear() === selectedDate.getFullYear());

    // Remove role-based filtering: show all projects to both roles
    return (
      matchesSearch &&
      matchesStatus &&
      matchesPastProjectFilter &&
      matchesDate
    );
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const statusOrder: { [key: string]: number } = {
      Pending: 1,
      "In Progress": 2,
      Completed: 3,
    };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return a.dueDate.toDate().getTime() - b.dueDate.toDate().getTime();
  });

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center font-inter">
      <AnimatePresence>
        {showIntroCalendar ? (
          <motion.div
            key="intro-calendar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="fixed inset-0 bg-gradient-to-br from-blue-400 to-purple-600 flex flex-col items-center justify-center text-white z-50"
          >
            <motion.svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-32 h-32 mb-6 animate-bounce"
              initial={{ scale: 0.5, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </motion.svg>
            <motion.h2
              className="text-4xl font-bold mb-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              Today is{" "}
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </motion.h2>
            <motion.p
              className="text-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              Loading your projects...
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            key="main-dashboard"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-7xl"
          >
            <h1 className="text-4xl font-extrabold text-gray-900 mb-2 text-center">
              📊 Project Dashboard
            </h1>
            {userId && (
              <p className="text-xl text-gray-700 mb-6 text-center">
                Welcome back
                {userRole === "manager" &&
                  userName && ( // Only show username for manager
                    <span className="font-semibold">, {userName}</span>
                  )}
                !
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              {/* Role Dropdown */}
              <select
                className="p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                value={userRole}
                onChange={handleRoleChange} // Use the new handler
              >
                <option value="employee">Employee View</option>
                <option value="manager">Manager View</option>
              </select>

              <input
                type="text"
                placeholder="Search projects by name, description, assigned to, or manager..."
                className="flex-1 min-w-[200px] p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>

              <label className="flex items-center space-x-2 text-gray-900">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-blue-600 rounded"
                  checked={showPastProjects}
                  onChange={(e) => setShowPastProjects(e.target.checked)}
                />
                <span>Show Past Projects</span>
              </label>

              {userRole === "manager" && ( // Only show "Add New Project" for managers
                <>
                  <button
                    onClick={() => handleOpenModal()}
                    className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition flex items-center space-x-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    <span>Add New Project</span>
                  </button>
                  <button
                    onClick={() => setShowSetPasswordModal(true)}
                    className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl shadow-md hover:bg-green-700 transition flex items-center space-x-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 6.75h9a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25h-9a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    </svg>
                    <span>Set Manager Password</span>
                  </button>
                </>
              )}

              <div className="relative">
                <button
                  className={`px-4 py-3 ${
                    selectedDate
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-200 text-gray-900"
                  } font-semibold rounded-xl shadow-md hover:bg-gray-300 transition flex items-center space-x-2`}
                  onClick={handleCalendarToggle}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                    />
                  </svg>
                  <span>Calendar</span>
                  {selectedDate && (
                    <span className="ml-2 text-xs">
                      ({selectedDate.toLocaleDateString()})
                    </span>
                  )}
                </button>

                {showCalendar && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg z-10 p-2 border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <button
                        onClick={clearDateFilter}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Clear filter
                      </button>
                      <button
                        onClick={() => setShowCalendar(false)}
                        className="text-xs text-gray-600 hover:text-gray-800"
                      >
                        Close
                      </button>
                    </div>
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-300 rounded-md text-gray-900"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleDateSelect(new Date(e.target.value));
                        }
                        setShowCalendar(false);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {selectedDate && (
              <div className="mb-4 flex items-center justify-center">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  Showing projects due on: {selectedDate.toLocaleDateString()}
                  <button
                    onClick={clearDateFilter}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}

            {loading && (
              <div className="text-center py-8 text-blue-600 text-lg">
                Loading projects...
              </div>
            )}
            {error && (
              <div className="text-center py-8 text-red-600 text-lg">
                Error: {error}
              </div>
            )}
            {!loading && !error && sortedProjects.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-lg">
                No projects found.{" "}
                {userId
                  ? "Start by adding a new project!"
                  : "Please ensure you are authenticated."}
              </div>
            )}

            {!loading && !error && sortedProjects.length > 0 && (
              <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky-header">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        Project Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        Assigned To
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        Manager Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        Creation Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        Manager Assigned
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        Actions
                      </th>
                      {userRole === "employee" && ( // New header for Query column
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                          Query
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedProjects.map((project) => (
                      <tr
                        key={project.id}
                        className="hover:bg-gray-50 transition-colors duration-150 ease-in-out"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {project.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                          {project.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            className={`py-1 px-2 rounded-full text-xs font-semibold
                              ${
                                project.status === "Pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : project.status === "In Progress"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            value={project.status}
                            onChange={(e) =>
                              handleUpdateStatus(
                                project.id!,
                                e.target.value as Project["status"]
                              )
                            }
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {project.assignedTo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {project.managerName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {project.dueDate.toDate().toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {project.creationDate.toDate().toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {project.managerAssigned ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="w-4 h-4 mr-1"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 2a.75.75 0 01.75.75V4.5a.75.75 0 01-1.5 0V2.75A.75.75 0 0110 2zM3 8.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM3.75 14a.75.75 0 01-.75-.75v-2.5a.75.75 0 011.5 0v2.5a.75.75 0 01-.75.75zM16.25 14a.75.75 0 01-.75-.75v-2.5a.75.75 0 011.5 0v2.5a.75.75 0 01-.75.75zM12.5 16.25a.75.75 0 01-.75.75H8.25a.75.75 0 010-1.5h3.5a.75.75 0 01.75.75zM16.5 8.75a.75.75 0 01.75-.75h-4.5a.75.75 0 010 1.5h4.5a.75.75 0 01-.75-.75zM10 20a.75.75 0 01-.75-.75V17.5a.75.75 0 011.5 0v1.75A.75.75 0 0110 20z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex space-x-2">
                            {userRole === "manager" ? ( // Only show edit/delete for managers
                              <>
                                <button
                                  onClick={() => handleOpenModal(project)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                  title="Edit Project"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                    className="w-5 h-5"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14.25v4.5a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(project.id!)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete Project"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                    className="w-5 h-5"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.92a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m-1.022.165L5.79 19.673a2.25 2.25 0 002.244 2.077h6.812a2.25 2.25 0 002.244-2.077L16.482 5.79m-4.444 0H3.375M9 6h6"
                                    />
                                  </svg>
                                </button>
                              </>
                            ) : // Employee view actions (e.g., no edit/delete, but status update is allowed)
                            null}
                          </div>
                        </td>
                        {userRole === "employee" && ( // New column for Query button
                          <td className="px-6 py-4 whitespace-nowrap text-left text-sm">
                            <button
                              onClick={() => handleRaiseQuery(project.name)}
                              className="px-3 py-1 bg-purple-500 text-white rounded-full text-xs font-semibold hover:bg-purple-600 transition"
                              title="Raise a Query"
                            >
                              Raise Query
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <AnimatePresence>
              {isModalOpen && (
                <motion.div
                  className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg"
                    initial={{ scale: 0.9, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 50 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                      {currentProject ? "Edit Project" : "Add New Project"}
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="projectName"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Project Name
                        </label>
                        <input
                          type="text"
                          id="projectName"
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="projectDescription"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Description
                        </label>
                        <textarea
                          id="projectDescription"
                          rows={3}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                          value={projectDescription}
                          onChange={(e) =>
                            setProjectDescription(e.target.value)
                          }
                          required
                        ></textarea>
                      </div>
                      <div>
                        <label
                          htmlFor="projectStatus"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Status
                        </label>
                        <select
                          id="projectStatus"
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                          value={projectStatus}
                          onChange={(e) =>
                            setProjectStatus(
                              e.target.value as Project["status"]
                            )
                          }
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="projectAssignedTo"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Assigned To (Employee Name)
                        </label>
                        <input
                          type="text"
                          id="projectAssignedTo"
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                          value={projectAssignedTo}
                          onChange={(e) => setProjectAssignedTo(e.target.value)}
                          required
                        />
                      </div>
                      {userRole === "manager" && ( // Only show manager name field in manager view
                        <div>
                          <label
                            htmlFor="projectManagerName"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Manager Name
                          </label>
                          <input
                            type="text"
                            id="projectManagerName"
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            value={projectManagerName}
                            onChange={(e) =>
                              setProjectManagerName(e.target.value)
                            }
                            required
                          />
                        </div>
                      )}
                      <div>
                        <label
                          htmlFor="projectDueDate"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Due Date
                        </label>
                        <input
                          type="date"
                          id="projectDueDate"
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                          value={projectDueDate}
                          onChange={(e) => setProjectDueDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex items-center">
                        <input
                          id="managerAssigned"
                          name="managerAssigned"
                          type="checkbox"
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          checked={projectManagerAssigned}
                          onChange={(e) =>
                            setProjectManagerAssigned(e.target.checked)
                          }
                        />
                        <label
                          htmlFor="managerAssigned"
                          className="ml-2 block text-sm text-gray-900"
                        >
                          Manager Assigned
                        </label>
                      </div>
                      <div className="flex justify-end space-x-3 mt-6">
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          className="px-5 py-2 bg-gray-300 text-gray-800 rounded-lg shadow-sm hover:bg-gray-400 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          onClick={handleSaveProject}
                          className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition"
                        >
                          {currentProject ? "Update Project" : "Add Project"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            <ConfirmationModal
              isOpen={showDeleteConfirm}
              message="Are you sure you want to delete this project? This action cannot be undone."
              onConfirm={handleConfirmDelete}
              onCancel={handleCancelDelete}
            />
            <AnimatePresence>
              {showPasswordPrompt && (
                <motion.div
                  className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm text-center"
                    initial={{ scale: 0.9, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 50 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                      Manager Access
                    </h2>
                    <p className="text-gray-700 mb-4">
                      Enter manager password to switch to Manager View:
                    </p>
                    <input
                      type="password"
                      className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Manager Password"
                      value={managerPasswordInput}
                      onChange={(e) => setManagerPasswordInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handleManagerLogin();
                        }
                      }}
                    />
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={handleManagerLogin}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => {
                          setShowPasswordPrompt(false);
                          setUserRole("employee"); // Revert to employee if cancelled
                          setManagerPasswordInput("");
                        }}
                        className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg shadow hover:bg-gray-400 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Modal for Setting Manager Password */}
            <AnimatePresence>
              {showSetPasswordModal && (
                <motion.div
                  className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm text-center"
                    initial={{ scale: 0.9, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 50 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                      Set Manager Password
                    </h2>
                    <p className="text-red-600 text-sm mb-4 font-semibold">
                      WARNING: For demo purposes, this stores the password in
                      plain text. DO NOT do this in a real application!
                    </p>
                    <input
                      type="password"
                      className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-green-500 focus:border-green-500 text-gray-900"
                      placeholder="New Manager Password"
                      value={newManagerPasswordInput}
                      onChange={(e) =>
                        setNewManagerPasswordInput(e.target.value)
                      }
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handleSetManagerPassword();
                        }
                      }}
                    />
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={handleSetManagerPassword}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition"
                      >
                        Set Password
                      </button>
                      <button
                        onClick={() => {
                          setShowSetPasswordModal(false);
                          setNewManagerPasswordInput("");
                        }}
                        className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg shadow hover:bg-gray-400 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster />
    </div>
  );
}