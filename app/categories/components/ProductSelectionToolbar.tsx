import React from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    IconButton,
    Chip,
    Toolbar,
    Tooltip,
} from '@mui/material';
import {
    Close,
    DriveFileMove,
    ContentCopy,
    Delete,
    SelectAll,
    Deselect,
} from '@mui/icons-material';

interface ProductSelectionToolbarProps {
    selectedCount: number;
    onClear: () => void;
    onSelectAll: () => void;
    onMove: () => void;
    onCopy: () => void;
    onDelete: () => void;
    totalProducts: number;
}

export default function ProductSelectionToolbar({
    selectedCount,
    onClear,
    onSelectAll,
    onMove,
    onCopy,
    onDelete,
    totalProducts,
}: ProductSelectionToolbarProps) {
    if (selectedCount === 0) return null;

    const allSelected = selectedCount === totalProducts;

    return (
        <Paper
            elevation={3}
            sx={{
                position: 'fixed',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1300,
                maxWidth: '90%',
                width: 'auto',
            }}
        >
            <Toolbar
                sx={{
                    gap: 1,
                    px: 2,
                    py: 1,
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    borderRadius: 1,
                }}
            >
                {/* Selection Info */}
                <Chip
                    label={`${selectedCount} selected`}
                    color="secondary"
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                />

                {/* Select All / Deselect All */}
                {!allSelected ? (
                    <Tooltip title="Select All">
                        <Button
                            startIcon={<SelectAll />}
                            onClick={onSelectAll}
                            size="small"
                            sx={{ color: 'white' }}
                        >
                            All
                        </Button>
                    </Tooltip>
                ) : (
                    <Tooltip title="Deselect All">
                        <Button
                            startIcon={<Deselect />}
                            onClick={onClear}
                            size="small"
                            sx={{ color: 'white' }}
                        >
                            None
                        </Button>
                    </Tooltip>
                )}

                {/* Divider */}
                <Box sx={{ width: 1, height: 32, bgcolor: 'rgba(255,255,255,0.3)', mx: 1 }} />

                {/* Bulk Actions */}
                <Tooltip title="Move selected products to another category">
                    <Button
                        startIcon={<DriveFileMove />}
                        onClick={onMove}
                        size="small"
                        sx={{ color: 'white' }}
                    >
                        Move
                    </Button>
                </Tooltip>

                <Tooltip title="Copy selected products to another category">
                    <Button
                        startIcon={<ContentCopy />}
                        onClick={onCopy}
                        size="small"
                        sx={{ color: 'white' }}
                    >
                        Copy
                    </Button>
                </Tooltip>

                <Tooltip title="Delete selected products">
                    <Button
                        startIcon={<Delete />}
                        onClick={onDelete}
                        size="small"
                        color="error"
                        sx={{
                            color: 'white',
                            '&:hover': {
                                backgroundColor: 'error.dark',
                            }
                        }}
                    >
                        Delete
                    </Button>
                </Tooltip>

                {/* Divider */}
                <Box sx={{ width: 1, height: 32, bgcolor: 'rgba(255,255,255,0.3)', mx: 1 }} />

                {/* Close */}
                <Tooltip title="Clear selection">
                    <IconButton
                        onClick={onClear}
                        size="small"
                        sx={{ color: 'white' }}
                    >
                        <Close />
                    </IconButton>
                </Tooltip>
            </Toolbar>
        </Paper>
    );
}
