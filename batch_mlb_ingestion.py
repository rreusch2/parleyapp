def get_target_players():
    """PHASE 4 EXPANSION - 120+ players with PROVEN MLBAM IDs using pybaseball.statcast_batter()"""
    return [
        # EXISTING WORKING PLAYERS (proven to work!)
        {'name': 'Aaron Judge', 'mlb_id': '592450', 'team': 'NYY', 'position': 'OF'},
        {'name': 'Shohei Ohtani', 'mlb_id': '660271', 'team': 'LAA', 'position': 'DH'},
        {'name': 'Juan Soto', 'mlb_id': '665742', 'team': 'NYY', 'position': 'OF'},
        {'name': 'José Altuve', 'mlb_id': '514888', 'team': 'HOU', 'position': '2B'},
        {'name': 'Mookie Betts', 'mlb_id': '605141', 'team': 'LAD', 'position': 'OF'},
        
        # PHASE 4 NEW SUPERSTARS
        {'name': 'Mike Trout', 'mlb_id': '545361', 'team': 'LAA', 'position': 'OF'},
        {'name': 'Bryce Harper', 'mlb_id': '547180', 'team': 'PHI', 'position': '1B'},
        {'name': 'Fernando Tatis Jr.', 'mlb_id': '665487', 'team': 'SD', 'position': 'OF'},
        {'name': 'Vladimir Guerrero Jr.', 'mlb_id': '665489', 'team': 'TOR', 'position': '1B'},
        {'name': 'Ronald Acuña Jr.', 'mlb_id': '660670', 'team': 'ATL', 'position': 'OF'},
        {'name': 'Pete Alonso', 'mlb_id': '624413', 'team': 'NYM', 'position': '1B'},
        {'name': 'Cody Bellinger', 'mlb_id': '641355', 'team': 'CHC', 'position': 'OF'},
        {'name': 'Freddie Freeman', 'mlb_id': '518692', 'team': 'LAD', 'position': '1B'},
        {'name': 'Kyle Tucker', 'mlb_id': '663656', 'team': 'HOU', 'position': 'OF'},
        {'name': 'Yordan Alvarez', 'mlb_id': '670541', 'team': 'HOU', 'position': 'DH'},
        
        # ALL-STAR TIER
        {'name': 'Manny Machado', 'mlb_id': '592518', 'team': 'SD', 'position': '3B'},
        {'name': 'Rafael Devers', 'mlb_id': '646240', 'team': 'BOS', 'position': '3B'},
        {'name': 'Francisco Lindor', 'mlb_id': '596019', 'team': 'NYM', 'position': 'SS'},
        {'name': 'Jose Ramirez', 'mlb_id': '608070', 'team': 'CLE', 'position': '3B'},
        {'name': 'Trea Turner', 'mlb_id': '607208', 'team': 'PHI', 'position': 'SS'},
        {'name': 'Julio Rodríguez', 'mlb_id': '677594', 'team': 'SEA', 'position': 'OF'},
        {'name': 'Corey Seager', 'mlb_id': '608369', 'team': 'TEX', 'position': 'SS'},
        {'name': 'Bo Bichette', 'mlb_id': '666182', 'team': 'TOR', 'position': 'SS'},
        {'name': 'Gunnar Henderson', 'mlb_id': '683002', 'team': 'BAL', 'position': 'SS'},
        {'name': 'Bobby Witt Jr.', 'mlb_id': '677951', 'team': 'KC', 'position': 'SS'},
        
        # YANKEES EXPANSION
        {'name': 'Gleyber Torres', 'mlb_id': '650402', 'team': 'NYY', 'position': '2B'},
        {'name': 'Anthony Rizzo', 'mlb_id': '519203', 'team': 'NYY', 'position': '1B'},
        {'name': 'Giancarlo Stanton', 'mlb_id': '519317', 'team': 'NYY', 'position': 'DH'},
        {'name': 'Alex Verdugo', 'mlb_id': '657077', 'team': 'NYY', 'position': 'OF'},
        {'name': 'Jazz Chisholm Jr.', 'mlb_id': '665862', 'team': 'NYY', 'position': 'OF'},
        
        # RED SOX
        {'name': 'Trevor Story', 'mlb_id': '596115', 'team': 'BOS', 'position': 'SS'},
        {'name': 'Tyler O\'Neill', 'mlb_id': '641933', 'team': 'BOS', 'position': 'OF'},
        {'name': 'Jarren Duran', 'mlb_id': '680776', 'team': 'BOS', 'position': 'OF'},
        {'name': 'Wilyer Abreu', 'mlb_id': '682928', 'team': 'BOS', 'position': 'OF'},
        
        # DODGERS EXPANSION
        {'name': 'Will Smith', 'mlb_id': '669257', 'team': 'LAD', 'position': 'C'},
        {'name': 'Max Muncy', 'mlb_id': '571970', 'team': 'LAD', 'position': '3B'},
        {'name': 'Teoscar Hernández', 'mlb_id': '606192', 'team': 'LAD', 'position': 'OF'},
        {'name': 'Chris Taylor', 'mlb_id': '621035', 'team': 'LAD', 'position': 'OF'},
        
        # PADRES EXPANSION
        {'name': 'Jake Cronenworth', 'mlb_id': '630105', 'team': 'SD', 'position': '2B'},
        {'name': 'Ha-seong Kim', 'mlb_id': '673490', 'team': 'SD', 'position': 'SS'},
        {'name': 'Jurickson Profar', 'mlb_id': '595777', 'team': 'SD', 'position': 'OF'},
        {'name': 'Jackson Merrill', 'mlb_id': '682922', 'team': 'SD', 'position': 'OF'},
        
        # ASTROS EXPANSION
        {'name': 'Alex Bregman', 'mlb_id': '608324', 'team': 'HOU', 'position': '3B'},
        {'name': 'Jeremy Peña', 'mlb_id': '665161', 'team': 'HOU', 'position': 'SS'},
        {'name': 'Yainer Diaz', 'mlb_id': '673237', 'team': 'HOU', 'position': 'C'},
        {'name': 'Chas McCormick', 'mlb_id': '676801', 'team': 'HOU', 'position': 'OF'},
        
        # MARINERS
        {'name': 'Cal Raleigh', 'mlb_id': '663728', 'team': 'SEA', 'position': 'C'},
        {'name': 'Eugenio Suárez', 'mlb_id': '553993', 'team': 'SEA', 'position': '3B'},
        {'name': 'Randy Arozarena', 'mlb_id': '668227', 'team': 'SEA', 'position': 'OF'},
        {'name': 'Josh Rojas', 'mlb_id': '668942', 'team': 'SEA', 'position': '3B'},
        
        # RANGERS
        {'name': 'Nathaniel Lowe', 'mlb_id': '663993', 'team': 'TEX', 'position': '1B'},
        {'name': 'Marcus Semien', 'mlb_id': '543760', 'team': 'TEX', 'position': '2B'},
        {'name': 'Adolis García', 'mlb_id': '666969', 'team': 'TEX', 'position': 'OF'},
        {'name': 'Wyatt Langford', 'mlb_id': '687093', 'team': 'TEX', 'position': 'OF'},
        
        # BRAVES
        {'name': 'Ozzie Albies', 'mlb_id': '645277', 'team': 'ATL', 'position': '2B'},
        {'name': 'Matt Olson', 'mlb_id': '621566', 'team': 'ATL', 'position': '1B'},
        {'name': 'Austin Riley', 'mlb_id': '663586', 'team': 'ATL', 'position': '3B'},
        {'name': 'Marcell Ozuna', 'mlb_id': '542303', 'team': 'ATL', 'position': 'DH'},
        
        # PHILLIES
        {'name': 'Kyle Schwarber', 'mlb_id': '656941', 'team': 'PHI', 'position': 'OF'},
        {'name': 'Nick Castellanos', 'mlb_id': '592206', 'team': 'PHI', 'position': 'OF'},
        {'name': 'Alec Bohm', 'mlb_id': '664761', 'team': 'PHI', 'position': '3B'},
        {'name': 'Bryson Stott', 'mlb_id': '681082', 'team': 'PHI', 'position': 'SS'},
        
        # METS
        {'name': 'Mark Vientos', 'mlb_id': '668901', 'team': 'NYM', 'position': '3B'},
        {'name': 'Brandon Nimmo', 'mlb_id': '607043', 'team': 'NYM', 'position': 'OF'},
        {'name': 'Starling Marte', 'mlb_id': '516782', 'team': 'NYM', 'position': 'OF'},
        {'name': 'Jesse Winker', 'mlb_id': '608385', 'team': 'NYM', 'position': 'OF'},
        
        # ORIOLES
        {'name': 'Adley Rutschman', 'mlb_id': '668939', 'team': 'BAL', 'position': 'C'},
        {'name': 'Anthony Santander', 'mlb_id': '623993', 'team': 'BAL', 'position': 'OF'},
        {'name': 'Ryan Mountcastle', 'mlb_id': '663624', 'team': 'BAL', 'position': '1B'},
        {'name': 'Cedric Mullins', 'mlb_id': '656775', 'team': 'BAL', 'position': 'OF'},
        
        # GUARDIANS
        {'name': 'Steven Kwan', 'mlb_id': '680757', 'team': 'CLE', 'position': 'OF'},
        {'name': 'Josh Naylor', 'mlb_id': '647304', 'team': 'CLE', 'position': '1B'},
        {'name': 'Andrés Giménez', 'mlb_id': '665926', 'team': 'CLE', 'position': '2B'},
        {'name': 'David Fry', 'mlb_id': '681807', 'team': 'CLE', 'position': 'C'},
        
        # ROYALS
        {'name': 'Salvador Perez', 'mlb_id': '521692', 'team': 'KC', 'position': 'C'},
        {'name': 'Vinnie Pasquantino', 'mlb_id': '686469', 'team': 'KC', 'position': '1B'},
        {'name': 'MJ Melendez', 'mlb_id': '669004', 'team': 'KC', 'position': 'OF'},
        {'name': 'Maikel Garcia', 'mlb_id': '665744', 'team': 'KC', 'position': '3B'},
        
        # BLUE JAYS
        {'name': 'George Springer', 'mlb_id': '543807', 'team': 'TOR', 'position': 'OF'},
        {'name': 'Daulton Varsho', 'mlb_id': '662139', 'team': 'TOR', 'position': 'OF'},
        {'name': 'Alejandro Kirk', 'mlb_id': '672386', 'team': 'TOR', 'position': 'C'},
        {'name': 'Ernie Clement', 'mlb_id': '676391', 'team': 'TOR', 'position': '2B'},
        
        # TWINS
        {'name': 'Carlos Correa', 'mlb_id': '621043', 'team': 'MIN', 'position': 'SS'},
        {'name': 'Byron Buxton', 'mlb_id': '621439', 'team': 'MIN', 'position': 'OF'},
        {'name': 'Ryan Jeffers', 'mlb_id': '680777', 'team': 'MIN', 'position': 'C'},
        {'name': 'Max Kepler', 'mlb_id': '596146', 'team': 'MIN', 'position': 'OF'},
        
        # TIGERS
        {'name': 'Riley Greene', 'mlb_id': '682985', 'team': 'DET', 'position': 'OF'},
        {'name': 'Spencer Torkelson', 'mlb_id': '679529', 'team': 'DET', 'position': '1B'},
        {'name': 'Kerry Carpenter', 'mlb_id': '681481', 'team': 'DET', 'position': 'OF'},
        {'name': 'Matt Vierling', 'mlb_id': '663837', 'team': 'DET', 'position': 'OF'},
        
        # WHITE SOX
        {'name': 'Luis Robert Jr.', 'mlb_id': '673357', 'team': 'CWS', 'position': 'OF'},
        {'name': 'Andrew Vaughn', 'mlb_id': '683734', 'team': 'CWS', 'position': '1B'},
        {'name': 'Gavin Sheets', 'mlb_id': '657757', 'team': 'CWS', 'position': '1B'},
        {'name': 'Paul DeJong', 'mlb_id': '657557', 'team': 'CWS', 'position': 'SS'},
        
        # CUBS
        {'name': 'Nico Hoerner', 'mlb_id': '663538', 'team': 'CHC', 'position': '2B'},
        {'name': 'Ian Happ', 'mlb_id': '664023', 'team': 'CHC', 'position': 'OF'},
        {'name': 'Seiya Suzuki', 'mlb_id': '673548', 'team': 'CHC', 'position': 'OF'},
        {'name': 'Dansby Swanson', 'mlb_id': '621020', 'team': 'CHC', 'position': 'SS'},
        
        # CARDINALS
        {'name': 'Nolan Arenado', 'mlb_id': '571448', 'team': 'STL', 'position': '3B'},
        {'name': 'Paul Goldschmidt', 'mlb_id': '502671', 'team': 'STL', 'position': '1B'},
        {'name': 'Willson Contreras', 'mlb_id': '575929', 'team': 'STL', 'position': 'C'},
        {'name': 'Brendan Donovan', 'mlb_id': '680977', 'team': 'STL', 'position': '2B'},
        
        # BREWERS
        {'name': 'Christian Yelich', 'mlb_id': '592885', 'team': 'MIL', 'position': 'OF'},
        {'name': 'William Contreras', 'mlb_id': '661388', 'team': 'MIL', 'position': 'C'},
        {'name': 'Willy Adames', 'mlb_id': '642715', 'team': 'MIL', 'position': 'SS'},
        {'name': 'Jackson Chourio', 'mlb_id': '694492', 'team': 'MIL', 'position': 'OF'},
        
        # REDS
        {'name': 'Elly De La Cruz', 'mlb_id': '672237', 'team': 'CIN', 'position': 'SS'},
        {'name': 'Spencer Steer', 'mlb_id': '668715', 'team': 'CIN', 'position': '3B'},
        {'name': 'Tyler Stephenson', 'mlb_id': '663886', 'team': 'CIN', 'position': 'C'},
        {'name': 'TJ Friedl', 'mlb_id': '670770', 'team': 'CIN', 'position': 'OF'},
        
        # DIAMONDBACKS
        {'name': 'Ketel Marte', 'mlb_id': '606466', 'team': 'ARI', 'position': '2B'},
        {'name': 'Corbin Carroll', 'mlb_id': '682998', 'team': 'ARI', 'position': 'OF'},
        {'name': 'Christian Walker', 'mlb_id': '572233', 'team': 'ARI', 'position': '1B'},
        {'name': 'Lourdes Gurriel Jr.', 'mlb_id': '666971', 'team': 'ARI', 'position': 'OF'},
        
        # GIANTS
        {'name': 'Matt Chapman', 'mlb_id': '656305', 'team': 'SF', 'position': '3B'},
        {'name': 'Jung Hoo Lee', 'mlb_id': '666173', 'team': 'SF', 'position': 'OF'},
        {'name': 'Heliot Ramos', 'mlb_id': '678578', 'team': 'SF', 'position': 'OF'},
        {'name': 'Tyler Fitzgerald', 'mlb_id': '669758', 'team': 'SF', 'position': 'SS'},
        
        # ROCKIES
        {'name': 'Ryan McMahon', 'mlb_id': '641857', 'team': 'COL', 'position': '3B'},
        {'name': 'Ezequiel Tovar', 'mlb_id': '678662', 'team': 'COL', 'position': 'SS'},
        {'name': 'Brenton Doyle', 'mlb_id': '674951', 'team': 'COL', 'position': 'OF'},
        {'name': 'Elias Díaz', 'mlb_id': '553869', 'team': 'COL', 'position': 'C'},
        
        # ANGELS
        {'name': 'Taylor Ward', 'mlb_id': '621493', 'team': 'LAA', 'position': 'OF'},
        {'name': 'Anthony Rendon', 'mlb_id': '543685', 'team': 'LAA', 'position': '3B'},
        {'name': 'Logan O\'Hoppe', 'mlb_id': '681351', 'team': 'LAA', 'position': 'C'},
        {'name': 'Mickey Moniak', 'mlb_id': '666160', 'team': 'LAA', 'position': 'OF'},
        
        # ATHLETICS
        {'name': 'Brent Rooker', 'mlb_id': '667670', 'team': 'OAK', 'position': 'DH'},
        {'name': 'Lawrence Butler', 'mlb_id': '694679', 'team': 'OAK', 'position': 'OF'},
        {'name': 'Seth Brown', 'mlb_id': '664913', 'team': 'OAK', 'position': 'OF'},
        {'name': 'Tyler Soderstrom', 'mlb_id': '686053', 'team': 'OAK', 'position': 'C'},
    ] 