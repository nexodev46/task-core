import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getUserProjects } from '../services/projectService';

interface Project {
  id: string;
  name: string;
  ownerId?: string;
}

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setCurrentProject(null);
      return;
    }

    const loadProjects = async () => {
      try {
        const projs = await getUserProjects(user.uid) as Project[];
        setProjects(projs);
        if (projs.length > 0) {
          setCurrentProject(projs[0]);
        } else {
          setCurrentProject(null);
        }
      } catch (err) {
        console.error('Error cargando proyectos:', err);
      }
    };

    loadProjects();
  }, [user]);

  return (
    <ProjectContext.Provider value={{ projects, currentProject, setCurrentProject }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
};
