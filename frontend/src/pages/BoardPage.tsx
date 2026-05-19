import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useThemeContext } from '../context/ThemeContext';
import DashboardTabs from '../components/DashboardTabs';

export default function BoardPage() {
  const { mode, toggleTheme } = useThemeContext();

  const handleFullScreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  const handleFilter = () => {
    alert('Abrir panel de filtros (próximamente)');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Tablero   {/* changed from Dashboard to Tablero */}
        </Typography>
        <Box>
          <Tooltip title="Agregar filtro">
            <IconButton onClick={handleFilter} color="primary">
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
      <DashboardTabs />
    </Box>
  );
}