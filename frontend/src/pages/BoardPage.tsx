import { Box, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useThemeContext } from '../context/ThemeContext';
import DashboardTabs from '../components/DashboardTabs';
import FilterPanel, { FilterConfig } from '../components/FilterPanel';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function BoardPage() {
  const { mode, toggleTheme } = useThemeContext();
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [filterOpen, setFilterOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterConfig>({
    status: { todo: true, in_progress: true, completed: true },
    tags: [],
    dateFilter: 'all',
    hasComments: 'all',
  });

  // Cargar etiquetas disponibles
  useEffect(() => {
    if (!user) return;
    const projectId = currentProject?.id || user.uid;
    const q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tags = new Set<string>();
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.tags && Array.isArray(data.tags)) {
          data.tags.forEach((tag: string) => tags.add(tag));
        }
      });
      setAvailableTags(Array.from(tags).sort());
    });

    return () => unsubscribe();
  }, [user, currentProject]);

  const handleFullScreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  const handleFilterApply = (newFilters: FilterConfig) => {
    setFilters(newFilters);
  };

  const hasActiveFilters =
    !filters.status.todo ||
    !filters.status.in_progress ||
    !filters.status.completed ||
    filters.tags.length > 0 ||
    filters.dateFilter !== 'all' ||
    filters.hasComments !== 'all';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Tablero
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasActiveFilters && (
            <Chip
              label={`${
                [
                  !filters.status.todo && '✓',
                  !filters.status.in_progress && '✓',
                  !filters.status.completed && '✓',
                  filters.tags.length > 0 && `${filters.tags.length} etiquetas`,
                  filters.dateFilter !== 'all' && 'Fecha',
                  filters.hasComments !== 'all' && 'Comentarios',
                ]
                  .filter(Boolean)
                  .join(', ')} filtros activos`}
              variant="filled"
              color="primary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          )}
          <Tooltip title="Filtros avanzados">
            <IconButton
              onClick={() => setFilterOpen(true)}
              color={hasActiveFilters ? 'primary' : 'inherit'}
              sx={{
                transition: 'all 0.2s ease',
                ...(hasActiveFilters && {
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.6 },
                  },
                }),
              }}
            >
              <FilterAltIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Pantalla completa">
            <IconButton onClick={handleFullScreen} color="primary">
              <FullscreenIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={mode === 'light' ? 'Modo oscuro' : 'Modo claro'}>
            <IconButton onClick={toggleTheme} color="primary">
              {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={handleFilterApply}
        availableTags={availableTags}
        activeFilters={filters}
      />

      <DashboardTabs filters={filters} />
    </Box>
  );
}