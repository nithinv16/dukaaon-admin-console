import React, { useEffect, useRef, useState } from 'react';
import {
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    MenuList,
    Paper,
    Popper,
    ClickAwayListener,
    Grow,
} from '@mui/material';
import { ChevronRight } from '@mui/icons-material';

export type ContextMenuItem = {
    label: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    divider?: false;
    disabled?: boolean;
    submenu?: ContextMenuItem[];
    danger?: boolean;
} | {
    divider: true;
    label?: never;
    icon?: never;
    onClick?: never;
    disabled?: never;
    submenu?: never;
    danger?: never;
};

interface ContextMenuProps {
    items: ContextMenuItem[];
    anchorPosition: { x: number; y: number } | null;
    onClose: () => void;
}

export default function ContextMenu({ items, anchorPosition, onClose }: ContextMenuProps) {
    const [submenuAnchor, setSubmenuAnchor] = useState<{ element: HTMLElement; items: ContextMenuItem[] } | null>(null);

    useEffect(() => {
        if (!anchorPosition) {
            setSubmenuAnchor(null);
        }
    }, [anchorPosition]);

    if (!anchorPosition) return null;

    const handleItemClick = (item: ContextMenuItem, event: React.MouseEvent<HTMLLIElement>) => {
        if (item.submenu) {
            setSubmenuAnchor({ element: event.currentTarget, items: item.submenu });
        } else {
            item.onClick?.();
            onClose();
        }
    };

    const handleSubmenuClose = () => {
        setSubmenuAnchor(null);
    };

    return (
        <>
            <Menu
                open={true}
                onClose={onClose}
                anchorReference="anchorPosition"
                anchorPosition={{ top: anchorPosition.y, left: anchorPosition.x }}
                slotProps={{
                    paper: {
                        sx: {
                            minWidth: 200,
                            boxShadow: 3,
                        },
                    },
                }}
            >
                {items.map((item, index) => (
                    <React.Fragment key={index}>
                        {item.divider ? (
                            <Divider />
                        ) : (
                            <MenuItem
                                onClick={(e) => handleItemClick(item, e)}
                                disabled={item.disabled}
                                sx={{
                                    color: item.danger ? 'error.main' : 'inherit',
                                    '&:hover': item.danger ? {
                                        backgroundColor: 'error.light',
                                        color: 'error.contrastText',
                                    } : undefined,
                                }}
                            >
                                {item.icon && <ListItemIcon sx={{ color: item.danger ? 'error.main' : 'inherit' }}>{item.icon}</ListItemIcon>}
                                <ListItemText>{item.label}</ListItemText>
                                {item.submenu && <ChevronRight sx={{ ml: 2 }} />}
                            </MenuItem>
                        )}
                    </React.Fragment>
                ))}
            </Menu>

            {/* Submenu */}
            {submenuAnchor && (
                <Popper
                    open={true}
                    anchorEl={submenuAnchor.element}
                    placement="right-start"
                    transition
                >
                    {({ TransitionProps }) => (
                        <Grow {...TransitionProps}>
                            <Paper sx={{ boxShadow: 3 }}>
                                <ClickAwayListener onClickAway={() => {
                                    handleSubmenuClose();
                                    onClose();
                                }}>
                                    <MenuList>
                                        {submenuAnchor.items.map((subitem, subindex) => (
                                            <MenuItem
                                                key={subindex}
                                                onClick={() => {
                                                    subitem.onClick?.();
                                                    handleSubmenuClose();
                                                    onClose();
                                                }}
                                                disabled={subitem.disabled}
                                                sx={{
                                                    color: subitem.danger ? 'error.main' : 'inherit',
                                                }}
                                            >
                                                {subitem.icon && <ListItemIcon sx={{ color: subitem.danger ? 'error.main' : 'inherit' }}>{subitem.icon}</ListItemIcon>}
                                                <ListItemText>{subitem.label}</ListItemText>
                                            </MenuItem>
                                        ))}
                                    </MenuList>
                                </ClickAwayListener>
                            </Paper>
                        </Grow>
                    )}
                </Popper>
            )}
        </>
    );
}
