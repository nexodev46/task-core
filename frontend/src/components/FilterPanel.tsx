import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  FormControlLabel,
  Checkbox,
  Button,
  Chip,
  Typography,
  Divider,
  TextField,
  Paper,
  Stack,
} from '@mui/material';
import { keyframes } from '@emotion/react';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';

const slideInAnimation = keyframes`
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

export interface FilterConfig {
  status: {
    todo: boolean;
    in_progress: boolean;
    completed: boolean;
  };
  tags: string[];
  dateFilter: 'all' | 'overdue' | 'due_soon' | 'no_date';
  hasComments: 'all' | 'with_comments' | 'without_comments';
}

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: FilterConfig) => void;
  availableTags: string[];
  activeFilters: FilterConfig;
}

const defaultFilters: FilterConfig = {
  status: { todo: true, in_progress: true, completed: true },
  tags: [],
  dateFilter: 'all',
  hasComments: 'all',
};

export default function FilterPanel({
  open,
  onClose,
  onApply,
  availableTags,
  activeFilters,
}: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterConfig>(activeFilters || defaultFilters);
  const initialFiltersRef = useRef<FilterConfig>(activeFilters || defaultFilters);

  useEffect(() => {
    if (open) {
      initialFiltersRef.current = activeFilters || defaultFilters;
      setFilters(activeFilters || defaultFilters);
    }
  }, [activeFilters, open]);

  const applyFilters = (nextFilters: FilterConfig) => {
    setFilters(nextFilters);
    onApply(nextFilters);
  };

  const handleStatusChange = (status: keyof FilterConfig['status']) => {
    const nextFilters = {
      ...filters,
      status: { ...filters.status, [status]: !filters.status[status] },
    };
    applyFilters(nextFilters);
  };

  const handleTagToggle = (tag: string) => {
    const nextFilters = {
      ...filters,
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    };
    applyFilters(nextFilters);
  };

  const handleDateFilterChange = (value: FilterConfig['dateFilter']) => {
    const nextFilters = { ...filters, dateFilter: value };
    applyFilters(nextFilters);
  };

  const handleCommentsFilterChange = (value: FilterConfig['hasComments']) => {
    const nextFilters = { ...filters, hasComments: value };
    applyFilters(nextFilters);
  };

  const handleReset = () => {
    applyFilters(defaultFilters);
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleCancel = () => {
    applyFilters(initialFiltersRef.current);
    onClose();
  };

  const hasActiveFilters = useMemo(() => {
    return (
      !filters.status.todo ||
      !filters.status.in_progress ||
      !filters.status.completed ||
      filters.tags.length > 0 ||
      filters.dateFilter !== 'all' ||
      filters.hasComments !== 'all'
    );
  }, [filters]);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '16px',
            animation: `${slideInAnimation} 0.3s ease-out`,
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          fontWeight: 'bold',
          fontSize: '1.3rem',
          pb: 1,
        }}
      >
        <FilterAltIcon sx={{ color: 'primary.main' }} />
        Filtros Avanzados
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ py: 3 }}>
        <Stack spacing={3}>
          {/* Estado */}
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 'bold',
                mb: 1.5,
                color: 'text.primary',
                textTransform: 'uppercase',
                fontSize: '0.85rem',
                letterSpacing: 0.5,
              }}
            >
              Estado
            </Typography>
            <Paper
              sx={{
                p: 2,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.status.todo}
                      onChange={() => handleStatusChange('todo')}
                    />
                  }
                  label={<Typography sx={{ fontWeight: 500 }}>Por hacer</Typography>}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.status.in_progress}
                      onChange={() => handleStatusChange('in_progress')}
                    />
                  }
                  label={<Typography sx={{ fontWeight: 500 }}>En progreso</Typography>}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.status.completed}
                      onChange={() => handleStatusChange('completed')}
                    />
                  }
                  label={<Typography sx={{ fontWeight: 500 }}>Completado</Typography>}
                />
              </Stack>
            </Paper>
          </Box>

          {/* Etiquetas */}
          {availableTags.length > 0 && (
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 'bold',
                  mb: 1.5,
                  color: 'text.primary',
                  textTransform: 'uppercase',
                  fontSize: '0.85rem',
                  letterSpacing: 0.5,
                }}
              >
                Etiquetas ({filters.tags.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {availableTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onClick={() => handleTagToggle(tag)}
                    variant={filters.tags.includes(tag) ? 'filled' : 'outlined'}
                    color={filters.tags.includes(tag) ? 'primary' : 'default'}
                    sx={{
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'scale(1.05)',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Fecha de vencimiento */}
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 'bold',
                mb: 1.5,
                color: 'text.primary',
                textTransform: 'uppercase',
                fontSize: '0.85rem',
                letterSpacing: 0.5,
              }}
            >
              Fecha de Vencimiento
            </Typography>
            <Paper
              sx={{
                p: 2,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.dateFilter === 'all'}
                      onChange={() => handleDateFilterChange('all')}
                    />
                  }
                  label={<Typography sx={{ fontWeight: 500 }}>Todos</Typography>}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.dateFilter === 'overdue'}
                      onChange={() => handleDateFilterChange('overdue')}
                    />
                  }
                  label={
                    <Typography sx={{ fontWeight: 500 }}>
                      Vencidas
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.dateFilter === 'due_soon'}
                      onChange={() => handleDateFilterChange('due_soon')}
                    />
                  }
                  label={
                    <Typography sx={{ fontWeight: 500 }}>
                      Por vencer (próximas 24h)
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.dateFilter === 'no_date'}
                      onChange={() => handleDateFilterChange('no_date')}
                    />
                  }
                  label={<Typography sx={{ fontWeight: 500 }}>Sin fecha</Typography>}
                />
              </Stack>
            </Paper>
          </Box>

          {/* Comentarios */}
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 'bold',
                mb: 1.5,
                color: 'text.primary',
                textTransform: 'uppercase',
                fontSize: '0.85rem',
                letterSpacing: 0.5,
              }}
            >
              Comentarios
            </Typography>
            <Paper
              sx={{
                p: 2,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.hasComments === 'all'}
                      onChange={() => handleCommentsFilterChange('all')}
                    />
                  }
                  label={<Typography sx={{ fontWeight: 500 }}>Todos</Typography>}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.hasComments === 'with_comments'}
                      onChange={() => handleCommentsFilterChange('with_comments')}
                    />
                  }
                  label={
                    <Typography sx={{ fontWeight: 500 }}>
                       Con comentarios
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.hasComments === 'without_comments'}
                      onChange={() => handleCommentsFilterChange('without_comments')}
                    />
                  }
                  label={
                    <Typography sx={{ fontWeight: 500 }}>
                      Sin comentarios
                    </Typography>
                  }
                />
              </Stack>
            </Paper>
          </Box>
        </Stack>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          startIcon={<ClearIcon />}
          onClick={handleReset}
          variant="outlined"
          sx={{ fontWeight: 600 }}
        >
          Limpiar
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleCancel} sx={{ fontWeight: 600 }}>
          Cancelar
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          sx={{
            fontWeight: 600,
            background: hasActiveFilters
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'default',
          }}
        >
          {hasActiveFilters && '✓ '}Aplicar Filtros
        </Button>
      </DialogActions>
    </Dialog>
  );
}
