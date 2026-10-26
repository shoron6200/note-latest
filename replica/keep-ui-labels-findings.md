# Google Keep 5.26.421.02.90: UI and labels findings

Source: static decode of `keep.apk` (sha256 f09354ba…30d6) with REA `decode-android-resources` (apktool 2.12.1) and a full apktool resource decode. Dex code was **not** decompiled, so behaviour below comes from layouts, menus, strings and dimensions. Nothing from Keep (code, icons, artwork, text) is copied into PocketLeaf; this file only records how Keep behaves.

## Home screen ("browse")
| Behaviour | Evidence |
|---|---|
| Top bar: a rounded search bar with a hamburger button on its left and the account avatar on its right; hint text is "Search Keep" | layout/browse_search_bar_layout.xml (menu_button 48dp, SearchBar, account_particle); string expressive_search_bar_hint |
| Grid/list toggle and sort buttons sit in the search bar's menu | menu/browse_search_bar_menu.xml (menu_switch_to_list_view / grid_view, menu_sort_order) |
| Notes split into a "Pinned" section and the rest | string section_header_pinned; layout browse_index_section_header |
| Cards: 8dp margin, 1dp hairline outline, 3dp outline when selected | dimens browse_note_card_margin, browse_note_hairline_stroke_width, browse_note_activated_stroke_width |
| Label chips shown on cards (20dp tall metadata chips) | layout browse_label_chip; dimen browse_meta_data_chip_height |
| Create menu: a FAB that opens a speed dial (Text, List, Image, Audio, Drawing) | layout gm3_browse_floating_speed_dial.xml; strings speed_dial_new_*_label |
| Long-press selection opens a contextual toolbar: Pin/Unpin, Reminder, Colour, Change labels, Archive; overflow holds Delete, Make a copy, Send | menu/selection_context_menu.xml |
| Empty label page says "No notes with this label yet" | string empty_view_no_labels |

## Drawer
| Behaviour | Evidence |
|---|---|
| Navigation drawer with Notes, Reminders, then a "Labels" header with an **Edit** button, one row per label (label icon + name), a "Create new label" row, then Archive, Trash, Settings | layouts drawer_fragment, drawer_landing_page_item, drawer_label_header, drawer_label, drawer_create_label_view; strings drawer_landing_page_*, labels_section_name, drawer_label_header_button_text, create_new_label_edit_mode |

## Labels
| Behaviour | Evidence |
|---|---|
| **"Edit labels" screen**: a "Create new label" row at the top (input + cancel X + confirm ✓); one row per label with an icon that becomes a delete button while editing, an inline name field, and a pencil that becomes a ✓ to confirm a rename | layouts label_editor_fragment, label_editor_create_label, label_editor_label_entry; string label_editor_fragment_title |
| Validation messages: blank name, name too long, duplicate name, label limit reached | strings label_name_blank, label_name_too_long, label_already_exists, label_limit_reached |
| Deleting asks "Delete label?" and removes the label from every note; the notes themselves are kept | strings delete_label_title, delete_label_message |
| **Label picker** (apply mode): a search field "Enter label name" in the top bar; rows are label + checkbox; a "Create "x"" row appears for a typed name that doesn't exist; with several notes selected, a label on only some of them shows a half-checked box | layouts label_editor_toolbar_apply_mode, label_picker_entry (checkbox, half_checked, plus, create_label_touch_layer); strings enter_label_name, create_new_label, partially_checked_checkbox |
| Entry points: the "Labels" item in the editor's ⋮ menu and "Change labels" in multi-select | strings menu_labels / menu_add_label, menu_change_labels |
| **Hashtags**: typing `#` in a note suggests labels; a "Create #x" row creates one; label chips offer "Go to label" and "Remove label"; tip text: "You can also add labels by typing #" | layout hashtag_suggest_new_label; strings hashtag_create_new, hashtag_action_navigate, hashtag_action_delete, hashtag_education_message |
| Labels appear as chips in the editor and on cards | layouts editor_label_chip_new, browse_label_chip |
| Search home page offers filters by Types, Labels and Colours | strings zero_search_types_label, zero_search_labels_label, zero_search_colors_label |

## Note editor
| Behaviour | Evidence |
|---|---|
| Top bar: back, Pin, Reminder, Archive | menu/editor_menu_expressive.xml |
| Bottom bar docked: Add (+), Background (palette), Formatting, Undo, Redo, and ⋮ Action | layout editor_docked_toolbar_default_controls |
| The bottom bar shows an "Edited …" timestamp | layout editor_bs_timestamp_menu_item |
| ⋮ menu sheet: Delete, Make a copy, Send, Labels | strings keep_menu_delete_note, keep_menu_clone, keep_menu_send, menu_labels |
| Checklist ⋮ actions: Hide checkboxes, Uncheck all, Delete checked items | menu/list_actions_menu_has_checked.xml |

## Limits
- Exact numbers (maximum label name length, maximum number of labels) are in code that wasn't decompiled. PocketLeaf will use 50 characters and 100 labels (inferred, not confirmed).
- Archive is part of Keep's drawer and selection UI, but the brief was labels and UI only, so archive stays out of scope.
