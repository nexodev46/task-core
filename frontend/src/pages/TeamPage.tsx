import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, TextField, Button, IconButton, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Chip, Grid, Tooltip, Divider,
  List, ListItem, ListItemAvatar, ListItemText, ListItemSecondaryAction, Tabs, Tab
} from '@mui/material';
import {
  Delete as DeleteIcon, ContentCopy as ContentCopyIcon, Add as AddIcon,
  Email as EmailIcon, VerifiedUser as VerifiedUserIcon, Pending as PendingIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { getUserProjects, getProjectMembers, createProject, deleteProject } from '../services/projectService';
import { createInvitation } from '../services/invitationService';

// Workaround: MUI Grid typings workaround
const GridAny: any = Grid;

interface Project {
  id: string;
  name: string;
  ownerId?: string;
}

interface Member {
  userId: string;
  role: string;
  email: string;
  fullName?: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  createdAt?: any;
  status?: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const { currentProject, setCurrentProject } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [deleteProjectConfirmOpen, setDeleteProjectConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Cargar proyectos del usuario - Se ejecuta cada vez que el componente se monta
  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }

    const loadProjects = async () => {
      setProjectsLoading(true);
      try {
        const loadedProjects = await getUserProjects(user.uid) as Project[];
        setProjects(loadedProjects);
        // Si hay proyecto actual seleccionado, mantenerlo
        if (currentProject?.id && loadedProjects.find(p => p.id === currentProject.id)) {
          setSelectedProjectId(currentProject.id);
        }
      } catch (error) {
        console.error('Error cargando proyectos:', error);
      } finally {
        setProjectsLoading(false);
      }
    };

    loadProjects();
  }, [user, currentProject?.id]);

  useEffect(() => {
    if (currentProject?.id && !selectedProjectId) {
      setSelectedProjectId(currentProject.id);
    }
  }, [currentProject, selectedProjectId]);

  // Al seleccionar proyecto, cargar miembros, invitaciones y verificar si el usuario es admin
  useEffect(() => {
    if (!selectedProjectId || !user) return;

    const loadProjectData = async () => {
      setMembersLoading(true);
        try {
          const membersList = await getProjectMembers(selectedProjectId) as Member[];
          setMembers(membersList);
          const currentUserMember = membersList.find(m => m.userId === user.uid);
          setIsAdmin(currentUserMember?.role === 'admin');
          setIsMember(!!currentUserMember);
          
          // Cargar invitaciones pendientes (simuladas - podrías integrar con tu servicio real)
          setPendingInvitations([]);
        } catch (error) {
          console.error('Error cargando miembros:', error);
        } finally {
          setMembersLoading(false);
        }
    };

    loadProjectData();
  }, [selectedProjectId, user]);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !selectedProjectId || !user) return;
    setInviteError('');
    setInviteMessage('');
    try {
      const projectName = projects.find(p => p.id === selectedProjectId)?.name || 'Proyecto';
      const senderName = user.displayName || user.email?.split('@')[0] || 'Usuario';
      const invitation = await createInvitation(inviteEmail, selectedProjectId, user.uid, projectName, senderName);
      const link = `${window.location.origin}/accept-invite/${invitation.token}`;
      setInviteLink(link);
      setInviteMessage(`✓ Invitación enviada a ${inviteEmail}`);
      setPendingInvitations([...pendingInvitations, { id: invitation.token, email: inviteEmail, status: 'pending' }]);
      setInviteEmail('');
    } catch (error) {
      setInviteError((error instanceof Error ? error.message : String(error)) || 'Error al enviar la invitación');
      console.error('Error en handleSendInvite:', error);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete || !selectedProjectId) return;
    // TODO: Implementar lógica para eliminar miembro del backend
    setMembers(members.filter(m => m.userId !== memberToDelete.userId));
    setDeleteConfirmOpen(false);
    setMemberToDelete(null);
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete.id);
      const remainingProjects = projects.filter(p => p.id !== projectToDelete.id);
      setProjects(remainingProjects);

      if (selectedProjectId === projectToDelete.id) {
        if (remainingProjects.length > 0) {
          setSelectedProjectId(remainingProjects[0].id);
          setCurrentProject(remainingProjects[0]);
        } else {
          setSelectedProjectId('');
          setCurrentProject(null);
        }
      }
    } catch (error) {
      console.error('Error eliminando proyecto:', error);
    } finally {
      setProjectToDelete(null);
      setDeleteProjectConfirmOpen(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !user) return;
    const projectId = await createProject(newProjectName, user.uid);
    setOpenCreate(false);
    setNewProjectName('');
    const updated = await getUserProjects(user.uid) as Project[];
    setProjects(updated);
    const createdProject = updated.find((project) => project.id === projectId);
    if (createdProject) {
      setCurrentProject(createdProject);
      setSelectedProjectId(createdProject.id);
    }
  };

  const getAvatarColor = (email: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
    const index = email.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getInitials = (fullName?: string, email?: string) => {
    if (fullName) {
      return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.split('@')[0].slice(0, 2).toUpperCase() || '?';
  };

  return (
    <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Encabezado */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}> Equipo</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>Gestiona tus proyectos y miembros colaborativos</Typography>
      </Box>

      {/* Sección de Proyectos */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}> Mis Proyectos</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCreate(true)}>Nuevo Proyecto</Button>
        </Box>

        {projectsLoading && projects.length === 0 ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {[1, 2, 3].map(idx => (
              <Paper key={idx} sx={{ p: 3, bgcolor: '#f5f5f5', height: 100, animation: 'pulse 2s infinite' }} />
            ))}
          </Box>
        ) : projects.length > 0 ? (
          <GridAny container spacing={2}>
            {projects.map(proj => (
              <GridAny xs={12} sm={6} md={4} key={proj.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: selectedProjectId === proj.id ? '2px solid #2196f3' : '1px solid #e0e0e0',
                    bgcolor: selectedProjectId === proj.id ? '#f5f5f5' : 'white',
                    '&:hover': {
                      boxShadow: 3,
                      transform: 'translateY(-4px)'
                    }
                  }}
                  onClick={() => {
                    setSelectedProjectId(proj.id);
                    setCurrentProject(proj);
                    setTabValue(0);
                  }}
                >
                  <CardContent sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, wordBreak: 'break-word' }}>{proj.name}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {proj.ownerId === user?.uid ? ' Mi proyecto' : ' Colaborativo'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Tooltip title="Invitar miembro">
                          <IconButton
                            aria-label="Invitar miembro"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProjectId(proj.id);
                              setCurrentProject(proj);
                              setInviteDialogOpen(true);
                            }}
                            sx={{ color: 'primary.main' }}
                          >
                            <EmailIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {proj.ownerId === user?.uid && (
                          <Tooltip title="Eliminar proyecto">
                            <IconButton
                              aria-label="Eliminar proyecto"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProjectToDelete(proj);
                                setDeleteProjectConfirmOpen(true);
                              }}
                              sx={{ color: 'error.main' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </GridAny>
            ))}
          </GridAny>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#fafafa' }}>
            <Typography variant="body1" sx={{ mb: 2 }}>No tienes proyectos aún</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCreate(true)}>Crear tu primer proyecto</Button>
          </Paper>
        )}
      </Box>

      {/* Sección de Gestión del Proyecto Seleccionado */}
      {selectedProjectId && (
        <Paper sx={{ borderRadius: 3, boxShadow: 2, overflow: 'hidden' }}>
          <Box sx={{ bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', p: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{projects.find(p => p.id === selectedProjectId)?.name}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>Gestiona miembros e invitaciones</Typography>
          </Box>

          {/* Tabs */}
          <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)} variant="fullWidth" sx={{ borderBottom: '1px solid #e0e0e0' }}>
            <Tab label={` Miembros (${members.length})`} />
            <Tab label={` Invitar ${pendingInvitations.length > 0 ? `(${pendingInvitations.length})` : ''}`} />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {/* TAB 0: Miembros */}
            {tabValue === 0 && (
              <Box>
                {membersLoading ? (
                  <Box sx={{ p: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Cargando miembros...</Typography>
                  </Box>
                ) : members.length > 0 ? (
                  <List>
                    {members.map((member, idx) => (
                      <Box key={member.userId}>
                        <ListItem sx={{ py: 2 }}>
                          <ListItemAvatar>
                            <Avatar
                              sx={{
                                bgcolor: getAvatarColor(member.email),
                                fontWeight: 600,
                                color: 'white'
                              }}
                            >
                              {getInitials(member.fullName, member.email)}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            disableTypography
                            primary={
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  {member.fullName || member.email}
                                </Typography>
                                {member.userId === user?.uid && <Chip label="Tú" size="small" color="primary" variant="outlined" />}
                              </Box>
                            }
                            secondary={
                              <Box sx={{ mt: 0.5 }}>
                                <Typography variant="caption" sx={{ display: 'block' }}>{member.email}</Typography>
                                <Box sx={{ mt: 0.5 }}>
                                  <Chip
                                    icon={member.role === 'admin' ? <VerifiedUserIcon /> : undefined}
                                    label={member.role === 'admin' ? 'Administrador' : 'Miembro'}
                                    size="small"
                                    color={member.role === 'admin' ? 'primary' : 'default'}
                                    variant="outlined"
                                  />
                                </Box>
                              </Box>
                            }
                          />
                          {isAdmin && member.userId !== user?.uid && (
                            <ListItemSecondaryAction>
                              <Tooltip title="Eliminar miembro">
                                <IconButton
                                  edge="end"
                                  onClick={() => {
                                    setMemberToDelete(member);
                                    setDeleteConfirmOpen(true);
                                  }}
                                  sx={{ color: 'error.main' }}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </ListItemSecondaryAction>
                          )}
                        </ListItem>
                        {idx < members.length - 1 && <Divider />}
                      </Box>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>No hay miembros en este proyecto</Typography>
                )}
              </Box>
            )}

            {/* TAB 1: Invitar Miembros */}
            {tabValue === 1 && isMember && (
              <Box>
                <Paper sx={{ p: 2.5, bgcolor: '#f9f9f9', borderRadius: 2, mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon fontSize="small" /> Enviar Invitación
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <TextField
                      placeholder="correo@ejemplo.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      sx={{ flexGrow: 1, minWidth: 250 }}
                      size="small"
                      type="email"
                    />
                    <Button
                      variant="contained"
                      onClick={handleSendInvite}
                      disabled={!inviteEmail.trim()}
                    >
                      Invitar
                    </Button>
                  </Box>
                </Paper>

                {inviteMessage && (
                  <Alert severity="success" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                    {inviteMessage}
                  </Alert>
                )}

                {inviteLink && (
                  <Paper sx={{ p: 2.5, bgcolor: '#f0f7ff', borderLeft: '4px solid #2196f3', borderRadius: 1, mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Enlace de Invitación</Typography>
                    <Box sx={{
                      p: 1.5,
                      bgcolor: 'white',
                      borderRadius: 1,
                      border: '1px solid #e0e0e0',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      wordBreak: 'break-all',
                      mb: 1
                    }}>
                      {inviteLink}
                    </Box>
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        alert('✓ Enlace copiado al portapapeles');
                      }}
                      sx={{ color: '#2196f3' }}
                    >
                      Copiar Enlace
                    </Button>
                  </Paper>
                )}

                {/* Invitaciones Pendientes */}
                {pendingInvitations.length > 0 && (
                  <Paper sx={{ p: 2.5, bgcolor: '#fff8e1', borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PendingIcon fontSize="small" /> Invitaciones Pendientes ({pendingInvitations.length})
                    </Typography>
                    <List dense>
                      {pendingInvitations.map(inv => (
                        <ListItem key={inv.id} secondaryAction={
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => setPendingInvitations(pendingInvitations.filter(i => i.id !== inv.id))}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        }>
                          <ListItemText
                            primary={inv.email}
                            secondary="Esperando respuesta..."
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}
              </Box>
            )}

            {tabValue === 1 && !isMember && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Solo los miembros del proyecto pueden invitar nuevos miembros</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Diálogo: Confirmar Eliminar Miembro */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Eliminar miembro</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Estás seguro de que quieres eliminar a <strong>{memberToDelete?.fullName || memberToDelete?.email}</strong> del proyecto?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button>
          <Button onClick={handleDeleteMember} color="error" variant="contained">Eliminar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteProjectConfirmOpen} onClose={() => setDeleteProjectConfirmOpen(false)}>
        <DialogTitle>Eliminar proyecto</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Estás seguro de que quieres eliminar el proyecto <strong>{projectToDelete?.name}</strong>? Esta acción también borrará sus miembros y tareas asociadas.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProjectConfirmOpen(false)}>Cancelar</Button>
          <Button onClick={handleConfirmDeleteProject} color="error" variant="contained">Eliminar proyecto</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)}>
        <DialogTitle>Invitar miembro</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Correo del invitado"
            type="email"
            fullWidth
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            size="small"
          />
          {inviteError && <Alert severity="error" sx={{ mt: 2 }}>{inviteError}</Alert>}
          {inviteMessage && <Alert severity="success" sx={{ mt: 2 }}>{inviteMessage}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setInviteDialogOpen(false); setInviteError(''); setInviteMessage(''); }}>Cancelar</Button>
          <Button onClick={async () => { await handleSendInvite(); if (!inviteError) setInviteDialogOpen(false); }} variant="contained" disabled={!inviteEmail.trim()}>Enviar invitación</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Crear Nuevo Proyecto */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}> Nuevo Proyecto Colaborativo</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            label="Nombre del proyecto"
            fullWidth
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Ej: Marketing 2024"
            variant="outlined"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newProjectName.trim()) {
                handleCreateProject();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCreate(false)}>Cancelar</Button>
          <Button onClick={handleCreateProject} variant="contained" disabled={!newProjectName.trim()}>Crear Proyecto</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}