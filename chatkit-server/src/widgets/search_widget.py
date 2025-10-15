"""
Web Search Widget - Shows live search progress with snippets
"""

from chatkit.widgets import (
    Card, Text, Title, Row, Col, Box, ListView, ListViewItem,
    Badge, Icon, Divider, Spacer, Markdown
)
from typing import List, Dict, Any

def create_search_widget(query: str, search_type: str = "general") -> Card:
    """Create initial search widget"""
    
    # Determine icon and color based on search type
    search_config = {
        "general": {"icon": "search", "color": "blue", "label": "Web Search"},
        "injury": {"icon": "alert", "color": "red", "label": "Injury Report"},
        "weather": {"icon": "cloud", "color": "gray", "label": "Weather Check"},
        "news": {"icon": "newspaper", "color": "green", "label": "Breaking News"},
        "odds": {"icon": "chart", "color": "purple", "label": "Odds Movement"}
    }.get(search_type, {"icon": "search", "color": "blue", "label": "Search"})
    
    return Card(
        size="lg",
        theme="dark",
        background="#1a1a2e",
        children=[
            Row(align="center", gap="12px", children=[
                Icon(name=search_config["icon"], size="lg", color=search_config["color"]),
                Col(flex=1, children=[
                    Title(value=search_config["label"], size="md", weight="bold"),
                    Text(value=f"Searching: {query}", size="sm", color="gray")
                ]),
                Badge(
                    label="LIVE",
                    color="danger",
                    pill=True,
                    variant="soft"
                )
            ]),
            Divider(spacing="12px"),
            Box(
                id="search-results",
                direction="col",
                gap="8px",
                padding="8px",
                children=[
                    Text(
                        id="search-status",
                        value="🔍 Scanning sources...",
                        streaming=True,
                        italic=True,
                        color="#888"
                    )
                ]
            )
        ]
    )

def update_search_progress(
    widget: Card, 
    snippet: str, 
    source: Dict[str, str],
    current_results: List[Dict] = None
) -> Card:
    """Update search widget with new result"""
    
    # Get existing results box
    results_box = widget.children[2]  # Box with id="search-results"
    
    # Create new result item
    new_result = ListViewItem(
        gap="8px",
        children=[
            Row(gap="8px", align="start", children=[
                Icon(name="link", size="sm", color="#168aa2"),
                Col(flex=1, children=[
                    Text(
                        value=source.get("title", "Result"),
                        weight="semibold",
                        size="sm",
                        maxLines=1,
                        truncate=True
                    ),
                    Text(
                        value=snippet,
                        size="sm",
                        color="#ccc",
                        maxLines=2,
                        truncate=True
                    ),
                    Text(
                        value=source.get("url", ""),
                        size="xs",
                        color="#666",
                        maxLines=1,
                        truncate=True
                    )
                ])
            ])
        ]
    )
    
    # Update children
    if len(results_box.children) == 1:  # Just status text
        results_box.children = [
            Text(
                id="search-status",
                value=f"✅ Found {1} result",
                color="#4CAF50"
            ),
            Spacer(minSize="8px"),
            ListView(
                children=[new_result],
                limit=5
            )
        ]
    else:
        # Update count and add to list
        status_text = results_box.children[0]
        list_view = results_box.children[2]
        
        current_count = len(list_view.children)
        status_text.value = f"✅ Found {current_count + 1} results"
        list_view.children.append(new_result)
    
    return widget

def create_search_complete_widget(
    query: str,
    results: List[Dict[str, Any]],
    search_type: str = "general"
) -> Card:
    """Create final search results widget"""
    
    result_items = []
    for idx, result in enumerate(results[:5]):  # Top 5 results
        result_items.append(
            ListViewItem(
                onClickAction=None,  # Could add click action
                children=[
                    Row(gap="12px", align="start", children=[
                        Badge(
                            label=str(idx + 1),
                            size="sm",
                            variant="soft",
                            pill=True
                        ),
                        Col(flex=1, children=[
                            Text(
                                value=result.get("title", ""),
                                weight="semibold",
                                truncate=True
                            ),
                            Markdown(
                                value=result.get("snippet", ""),
                                streaming=False
                            ),
                            Row(gap="8px", children=[
                                Badge(
                                    label=result.get("source", "Web"),
                                    size="sm",
                                    color="secondary",
                                    variant="outline"
                                ),
                                Text(
                                    value=result.get("relevance", "High"),
                                    size="xs",
                                    color="green" if result.get("relevance") == "High" else "gray"
                                )
                            ])
                        ])
                    ])
                ]
            )
        )
    
    return Card(
        size="lg",
        status={
            "text": f"Found {len(results)} results for: {query}",
            "icon": "check"
        },
        children=[
            Title(value="🔍 Search Results", size="md"),
            Divider(),
            ListView(children=result_items)
        ]
    )
