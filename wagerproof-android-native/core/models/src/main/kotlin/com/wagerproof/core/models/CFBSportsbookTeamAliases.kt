package com.wagerproof.core.models

/**
 * Strict bridge between the Odds API's school+mascot names and the short
 * school names stored by `cfb_dryrun_games`. Port of iOS `CFBSportsbookTeamAliases`.
 *
 * Every supported school+mascot string is mapped explicitly. A caller still
 * supplies the two teams on the requested game, so even a valid alias cannot
 * attach prices from another matchup.
 */
object CFBSportsbookTeamAliases {
    private val rawAliases: Map<String, String> = mapOf(
        "Air Force Falcons" to "Air Force",
        "Akron Zips" to "Akron",
        "Alabama Crimson Tide" to "Alabama",
        "Appalachian State Mountaineers" to "App State",
        "Arizona State Sun Devils" to "Arizona State",
        "Arizona Wildcats" to "Arizona",
        "Arkansas Razorbacks" to "Arkansas",
        "Arkansas State Red Wolves" to "Arkansas State",
        "Army Black Knights" to "Army",
        "Auburn Tigers" to "Auburn",
        "Ball State Cardinals" to "Ball State",
        "Baylor Bears" to "Baylor",
        "Boise State Broncos" to "Boise State",
        "Boston College Eagles" to "Boston College",
        "Bowling Green Falcons" to "Bowling Green",
        "Buffalo Bulls" to "Buffalo",
        "BYU Cougars" to "BYU",
        "California Golden Bears" to "California",
        "Central Michigan Chippewas" to "Central Michigan",
        "Charlotte 49ers" to "Charlotte",
        "Cincinnati Bearcats" to "Cincinnati",
        "Clemson Tigers" to "Clemson",
        "Coastal Carolina Chanticleers" to "Coastal Carolina",
        "Colorado Buffaloes" to "Colorado",
        "Colorado State Rams" to "Colorado State",
        "Delaware Blue Hens" to "Delaware",
        "Duke Blue Devils" to "Duke",
        "East Carolina Pirates" to "East Carolina",
        "Eastern Michigan Eagles" to "Eastern Michigan",
        "Florida Atlantic Owls" to "Florida Atlantic",
        "Florida Gators" to "Florida",
        "Florida International Panthers" to "Florida International",
        "Florida State Seminoles" to "Florida State",
        "Fresno State Bulldogs" to "Fresno State",
        "Georgia Bulldogs" to "Georgia",
        "Georgia Southern Eagles" to "Georgia Southern",
        "Georgia State Panthers" to "Georgia State",
        "Georgia Tech Yellow Jackets" to "Georgia Tech",
        "Hawaii Rainbow Warriors" to "Hawai'i",
        "Houston Cougars" to "Houston",
        "Idaho Vandals" to "Idaho",
        "Illinois Fighting Illini" to "Illinois",
        "Indiana Hoosiers" to "Indiana",
        "Iowa Hawkeyes" to "Iowa",
        "Iowa State Cyclones" to "Iowa State",
        "Jacksonville State Gamecocks" to "Jacksonville State",
        "James Madison Dukes" to "James Madison",
        "Kansas Jayhawks" to "Kansas",
        "Kansas State Wildcats" to "Kansas State",
        "Kennesaw State Owls" to "Kennesaw State",
        "Kent State Golden Flashes" to "Kent State",
        "Kentucky Wildcats" to "Kentucky",
        "Liberty Flames" to "Liberty",
        "Louisiana Ragin Cajuns" to "Louisiana",
        "Louisiana Tech Bulldogs" to "Louisiana Tech",
        "Louisville Cardinals" to "Louisville",
        "LSU Tigers" to "LSU",
        "Marshall Thundering Herd" to "Marshall",
        "Maryland Terrapins" to "Maryland",
        "Memphis Tigers" to "Memphis",
        "Miami (OH) RedHawks" to "Miami (OH)",
        "Miami Hurricanes" to "Miami",
        "Miami RedHawks" to "Miami (OH)",
        "Michigan State Spartans" to "Michigan State",
        "Michigan Wolverines" to "Michigan",
        "Middle Tennessee Blue Raiders" to "Middle Tennessee",
        "Minnesota Golden Gophers" to "Minnesota",
        "Mississippi Rebels" to "Ole Miss",
        "Mississippi State Bulldogs" to "Mississippi State",
        "Missouri State Bears" to "Missouri State",
        "Missouri Tigers" to "Missouri",
        "Navy Midshipmen" to "Navy",
        "NC State Wolfpack" to "NC State",
        "Nebraska Cornhuskers" to "Nebraska",
        "Nevada Wolf Pack" to "Nevada",
        "New Mexico Lobos" to "New Mexico",
        "New Mexico State Aggies" to "New Mexico State",
        "North Carolina Tar Heels" to "North Carolina",
        "North Dakota State Bison" to "North Dakota State",
        "North Texas Mean Green" to "North Texas",
        "Northern Illinois Huskies" to "Northern Illinois",
        "Northwestern Wildcats" to "Northwestern",
        "Notre Dame Fighting Irish" to "Notre Dame",
        "Ohio Bobcats" to "Ohio",
        "Ohio State Buckeyes" to "Ohio State",
        "Oklahoma Sooners" to "Oklahoma",
        "Oklahoma State Cowboys" to "Oklahoma State",
        "Old Dominion Monarchs" to "Old Dominion",
        "Ole Miss Rebels" to "Ole Miss",
        "Oregon Ducks" to "Oregon",
        "Oregon State Beavers" to "Oregon State",
        "Penn State Nittany Lions" to "Penn State",
        "Pittsburgh Panthers" to "Pittsburgh",
        "Purdue Boilermakers" to "Purdue",
        "Rice Owls" to "Rice",
        "Rutgers Scarlet Knights" to "Rutgers",
        "Sacramento State Hornets" to "Sacramento State",
        "Sam Houston State Bearkats" to "Sam Houston",
        "San Diego State Aztecs" to "San Diego State",
        "San Jose State Spartans" to "San José State",
        "SMU Mustangs" to "SMU",
        "South Alabama Jaguars" to "South Alabama",
        "South Carolina Gamecocks" to "South Carolina",
        "South Florida Bulls" to "South Florida",
        "Southern California Trojans" to "USC",
        "Southern Mississippi Golden Eagles" to "Southern Miss",
        "Stanford Cardinal" to "Stanford",
        "Syracuse Orange" to "Syracuse",
        "TCU Horned Frogs" to "TCU",
        "Temple Owls" to "Temple",
        "Tennessee Volunteers" to "Tennessee",
        "Texas A&M Aggies" to "Texas A&M",
        "Texas Longhorns" to "Texas",
        "Texas State Bobcats" to "Texas State",
        "Texas Tech Red Raiders" to "Texas Tech",
        "Toledo Rockets" to "Toledo",
        "Troy Trojans" to "Troy",
        "Tulane Green Wave" to "Tulane",
        "Tulsa Golden Hurricane" to "Tulsa",
        "UAB Blazers" to "UAB",
        "UCF Knights" to "UCF",
        "UCLA Bruins" to "UCLA",
        "UConn Huskies" to "UConn",
        "UL Monroe Warhawks" to "UL Monroe",
        "UMass Minutemen" to "Massachusetts",
        "UNLV Rebels" to "UNLV",
        "USC Trojans" to "USC",
        "Utah State Aggies" to "Utah State",
        "Utah Utes" to "Utah",
        "UTEP Miners" to "UTEP",
        "UTSA Roadrunners" to "UTSA",
        "Vanderbilt Commodores" to "Vanderbilt",
        "Virginia Cavaliers" to "Virginia",
        "Virginia Tech Hokies" to "Virginia Tech",
        "Wake Forest Demon Deacons" to "Wake Forest",
        "Washington Huskies" to "Washington",
        "Washington State Cougars" to "Washington State",
        "West Virginia Mountaineers" to "West Virginia",
        "Western Kentucky Hilltoppers" to "Western Kentucky",
        "Western Michigan Broncos" to "Western Michigan",
        "Wisconsin Badgers" to "Wisconsin",
        "Wyoming Cowboys" to "Wyoming",
    )

    private val aliases: Map<String, String> =
        rawAliases.mapKeys { normalize(it.key) }

    val supportedAliasCount: Int get() = rawAliases.size

    fun canonicalName(oddsAPIName: String, candidates: List<String>): String? {
        val canonical = aliases[normalize(oddsAPIName)] ?: return null
        return candidates.firstOrNull { normalize(it) == normalize(canonical) }
    }

    fun matches(oddsAPIName: String, canonicalName: String): Boolean =
        canonicalName(oddsAPIName, listOf(canonicalName)) != null

    internal fun normalize(value: String): String {
        val folded = java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
        return folded
            .replace(".", "")
            .replace("'", "")
            .replace("’", "")
            .lowercase()
            .split(Regex("\\s+"))
            .filter { it.isNotEmpty() }
            .joinToString(" ")
    }
}
