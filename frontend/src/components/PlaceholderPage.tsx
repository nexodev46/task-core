import { Box, Typography, Paper } from '@mui/material';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold' }} gutterBottom>
        {title}
      </Typography>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="body1" color="text.secondary">
          {description || `La sección "${title}" estará disponible próximamente.`}
        </Typography>
      </Paper>
    </Box>
  );
}